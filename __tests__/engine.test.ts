import {
  deleteRoutine,
  markStep,
  moveRun,
  prune,
  saveRoutine,
  setRunSkipped,
  shiftDay,
  snoozeStep,
  unmarkStep,
} from '../src/engine/actions';
import { planNotifications } from '../src/engine/plan';
import {
  buildRun,
  dueSteps,
  listRuns,
  nextUpcoming,
  parseNotifId,
  runId,
  runsForDay,
  stepNotifId,
} from '../src/engine/runs';
import { atTime, everyHours, MINUTE, nearestAt } from '../src/lib/time';
import { defaultData } from '../src/model/defaults';
import { sampleData } from './fixtures';
import { migrateV2, normalize } from '../src/model/migrate';
import { AppData } from '../src/model/types';

const DAY = '2026-10-12';
const t = (hhmm: string, day = DAY) => atTime(day, hhmm);

/** Fresh default data, created the day before so all of DAY's runs exist. */
const setup = (): AppData => sampleData(t('08:00', '2026-10-11'));

const EYES_AM = runId('eyes-am-pm', DAY, '09:00');

describe('fresh install', () => {
  it('starts with no medicines and no routines', () => {
    const data = defaultData();
    expect(data.meds).toEqual([]);
    expect(data.routines).toEqual([]);
    expect(planNotifications(data, t('08:00')).alerts).toEqual([]);
  });
});

describe('runs', () => {
  it('lists every run of the day in time order', () => {
    const runs = runsForDay(setup(), DAY, t('08:00'));
    expect(runs.map(r => `${r.time} ${r.routineName}`)).toEqual([
      '09:00 Μάτια',
      '09:00 Παυσίπονο',
      '15:00 Μάτια (μεσημέρι)',
      '15:00 Παυσίπονο',
      '21:00 Μάτια',
      '21:00 Παυσίπονο',
    ]);
    expect(runs.every(r => r.status === 'upcoming')).toBe(true);
  });

  it('waits for the first medicine before timing the next one', () => {
    const data = setup();
    let run = buildRun(data, EYES_AM, t('09:05'))!;
    expect(run.steps[0].status).toBe('due');
    expect(run.steps[1].status).toBe('waiting');
    expect(run.steps[1].dueAt).toBe(t('09:20')); // estimate

    // Given 7 minutes late → the next one is due 20′ after that, not at 09:20.
    markStep(data, EYES_AM, 0, 'given', t('09:07'));
    run = buildRun(data, EYES_AM, t('09:10'))!;
    expect(run.steps[0].status).toBe('given');
    expect(run.steps[1].status).toBe('upcoming');
    expect(run.steps[1].dueAt).toBe(t('09:27'));
    expect(run.status).toBe('active');

    run = buildRun(data, EYES_AM, t('09:27'))!;
    expect(run.steps[1].status).toBe('due');

    markStep(data, EYES_AM, 1, 'given', t('09:29'));
    run = buildRun(data, EYES_AM, t('09:30'))!;
    expect(run.status).toBe('done');
    expect(run.givenCount).toBe(2);
  });

  it('makes the next medicine due straight away when one is skipped', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'skipped', t('09:03'));
    const run = buildRun(data, EYES_AM, t('09:04'))!;
    expect(run.steps[1].status).toBe('due');
    expect(run.steps[1].dueAt).toBe(t('09:03'));
  });

  it('snoozes a single step', () => {
    const data = setup();
    snoozeStep(data, EYES_AM, 0, t('09:10'));
    expect(buildRun(data, EYES_AM, t('09:05'))!.steps[0]).toMatchObject({ status: 'upcoming', snoozed: true });
    expect(buildRun(data, EYES_AM, t('09:10'))!.steps[0].status).toBe('due');
  });

  it('marks unanswered doses as missed after the set time', () => {
    const data = setup();
    const run = buildRun(data, EYES_AM, t('09:00') + data.settings.missAfterMin * MINUTE)!;
    expect(run.steps.map(s => s.status)).toEqual(['missed', 'missed']);
    expect(run.status).toBe('missed');
  });

  it('moves one run without touching the others', () => {
    const data = setup();
    moveRun(data, EYES_AM, t('10:30'));
    const runs = runsForDay(data, DAY, t('08:00'));
    const eyes = runs.find(r => r.id === EYES_AM)!;
    expect(eyes).toMatchObject({ moved: true, startAt: t('10:30'), plannedAt: t('09:00') });
    expect(buildRun(data, EYES_AM, t('09:30'))!.steps[0].status).toBe('upcoming');
    // Same routine the next day is unchanged.
    const tomorrow = buildRun(data, runId('eyes-am-pm', '2026-10-13', '09:00'), t('08:00'))!;
    expect(tomorrow.moved).toBe(false);
    // Runs are sorted by their (new) start time.
    expect(runs.map(r => r.time)).toEqual(['09:00', '09:00', '15:00', '15:00', '21:00', '21:00']);
    expect(runs.findIndex(r => r.id === EYES_AM)).toBe(1);
  });

  it('skips one run', () => {
    const data = setup();
    setRunSkipped(data, EYES_AM, true);
    const run = buildRun(data, EYES_AM, t('09:30'))!;
    expect(run.status).toBe('skipped');
    expect(run.steps.every(s => s.status === 'skipped')).toBe(true);
    setRunSkipped(data, EYES_AM, false);
    expect(data.runs[EYES_AM]).toBeUndefined();
  });

  it('shifts every run of the day that has not started', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'given', t('09:00'));
    shiftDay(data, DAY, 60, t('09:01'));
    const runs = runsForDay(data, DAY, t('09:01'));
    expect(runs.find(r => r.id === EYES_AM)!.moved).toBe(false); // already started
    expect(runs.filter(r => r.moved).map(r => r.id)).toEqual([
      runId('painkiller', DAY, '09:00'),
      runId('eyes-noon', DAY, '15:00'),
      runId('painkiller', DAY, '15:00'),
      runId('eyes-am-pm', DAY, '21:00'),
      runId('painkiller', DAY, '21:00'),
    ]);
  });

  it('undo resets the later steps of the chain too', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'given', t('09:00'));
    markStep(data, EYES_AM, 1, 'given', t('09:20'));
    unmarkStep(data, EYES_AM, 0);
    expect(data.runs[EYES_AM]).toBeUndefined();
    expect(buildRun(data, EYES_AM, t('09:30'))!.steps.map(s => s.status)).toEqual(['due', 'waiting']);
  });

  it('does not create runs from before the routine existed', () => {
    const data = sampleData(t('10:00'));
    const times = runsForDay(data, DAY, t('10:00')).map(r => r.time);
    expect(times).toEqual(['15:00', '15:00', '21:00', '21:00']);
  });

  it('does not ring for a time added today that already passed', () => {
    const data = setup();
    const routine = data.routines.find(r => r.id === 'painkiller')!;
    // At 10:00 the painkiller moves to 07:00 / 15:00 / 23:00.
    saveRoutine(data, { ...routine, times: everyHours('07:00', 8) }, t('10:00'));
    const times = runsForDay(data, DAY, t('10:00'))
      .filter(r => r.routineId === 'painkiller')
      .map(r => r.time);
    expect(times).toEqual(['15:00', '23:00']); // no overdue 07:00 today
    const tomorrow = runsForDay(data, '2026-10-13', t('10:00')).filter(r => r.routineId === 'painkiller');
    expect(tomorrow.map(r => r.time)).toEqual(['07:00', '15:00', '23:00']);
    // Saving again later keeps the time it was added.
    saveRoutine(data, { ...data.routines.find(r => r.id === 'painkiller')!, enabled: true }, t('12:00'));
    expect(data.routines.find(r => r.id === 'painkiller')!.timeAddedAt).toEqual({
      '07:00': t('10:00'),
      '23:00': t('10:00'),
    });
  });

  it('spreads doses every N hours', () => {
    expect(everyHours('07:00', 8)).toEqual(['07:00', '15:00', '23:00']);
    expect(everyHours('08:00', 12)).toEqual(['08:00', '20:00']);
    expect(everyHours('07:00', 6)).toEqual(['01:00', '07:00', '13:00', '19:00']);
  });

  describe('every 8 hours, counted from the previous dose', () => {
    const PILL = (time: string, day = DAY) => runId('every8', day, time);
    const every8 = (): AppData => {
      const data = setup();
      data.routines.push({
        id: 'every8',
        name: 'Κάθε 8 ώρες',
        times: ['07:00', '15:00', '23:00'],
        days: [],
        steps: [{ id: 's8', medId: 'depon', waitMin: 0 }],
        enabled: true,
        createdAt: t('08:00', '2026-10-11'),
        fromGiven: true,
      });
      return data;
    };

    it('keeps the planned times while nothing is late', () => {
      const data = every8();
      expect(buildRun(data, PILL('15:00'), t('08:00'))!.startAt).toBe(t('15:00'));
      expect(buildRun(data, PILL('23:00'), t('08:00'))!.startAt).toBe(t('23:00'));
    });

    it('moves the rest of the day along as soon as the first dose is late', () => {
      const data = every8();
      markStep(data, PILL('07:00'), 0, 'given', t('08:00'));
      expect(buildRun(data, PILL('15:00'), t('08:05'))!.startAt).toBe(t('16:00'));
      // The third follows the second's new time before the second is given…
      expect(buildRun(data, PILL('23:00'), t('08:05'))!.startAt).toBe(t('00:00', '2026-10-13'));
      // …and moves again when the second is actually given.
      markStep(data, PILL('15:00'), 0, 'given', t('16:30'));
      expect(buildRun(data, PILL('23:00'), t('16:35'))!.startAt).toBe(t('00:30', '2026-10-13'));
    });

    it('goes back to the planned time when the previous dose is skipped', () => {
      const data = every8();
      markStep(data, PILL('07:00'), 0, 'given', t('08:00'));
      markStep(data, PILL('15:00'), 0, 'skipped', t('15:30'));
      expect(buildRun(data, PILL('23:00'), t('15:35'))!.startAt).toBe(t('23:00'));
    });

    it('moves the next dose 8 hours after the previous one was given', () => {
      const data = every8();
      markStep(data, PILL('07:00'), 0, 'given', t('08:22'));
      const next = buildRun(data, PILL('15:00'), t('08:30'))!;
      expect(next.startAt).toBe(t('16:22'));
      expect(next.followed).toBe(true);
      expect(next.moved).toBe(false);
      const alert = planNotifications(data, t('08:30')).alerts.find(a => a.notifId === stepNotifId(PILL('15:00'), 0));
      expect(alert?.at).toBe(t('16:22')); // the alarm moves too

      // …and the one after that from the second dose, even past midnight.
      markStep(data, PILL('15:00'), 0, 'given', t('16:40'));
      expect(buildRun(data, PILL('23:00'), t('17:00'))!.startAt).toBe(t('00:40', '2026-10-13'));
      // The first dose of the next day stays at its time.
      expect(buildRun(data, PILL('07:00', '2026-10-13'), t('17:00'))!.startAt).toBe(t('07:00', '2026-10-13'));
    });

    it('puts a time changed to just after midnight on the next day', () => {
      expect(nearestAt(DAY, '00:00', t('23:00'))).toBe(t('00:00', '2026-10-13'));
      expect(nearestAt(DAY, '23:30', t('23:00'))).toBe(t('23:30'));
      expect(nearestAt(DAY, '23:30', t('00:30'))).toBe(t('23:30', '2026-10-11'));
      expect(nearestAt(DAY, '16:20', t('15:00'))).toBe(t('16:20'));
    });

    it('repairs a dose moved to "00:00" of the same day by the old time sheet', () => {
      const data = every8();
      moveRun(data, PILL('23:00'), t('00:00')); // what the old sheet saved
      const fixed = normalize(JSON.parse(JSON.stringify(data)));
      expect(fixed.runs[PILL('23:00')].startAt).toBe(t('00:00', '2026-10-13'));
    });

    it('lets a time changed by hand win', () => {
      const data = every8();
      markStep(data, PILL('07:00'), 0, 'given', t('08:22'));
      moveRun(data, PILL('15:00'), t('17:30'));
      expect(buildRun(data, PILL('15:00'), t('08:30'))!.startAt).toBe(t('17:30'));
    });

    it('turns on by itself for routines spread around the clock', () => {
      const data = setup();
      data.routines.push({ ...data.routines[0], id: 'x', times: ['07:00', '15:00', '23:00'] });
      const norm = normalize(JSON.parse(JSON.stringify(data)));
      expect(norm.routines.find(r => r.id === 'x')?.fromGiven).toBe(true);
      // 09:00 · 21:00 and 09:00 · 15:00 · 21:00 stay at fixed times.
      expect(norm.routines.filter(r => r.id !== 'x').every(r => r.fromGiven === false)).toBe(true);
    });
  });

  it('leaves out medicines whose treatment ended', () => {
    const data = setup();
    data.meds.find(m => m.id === 'depon')!.endDate = '2026-10-11';
    const runs = runsForDay(data, DAY, t('08:00'));
    expect(runs.some(r => r.routineId === 'painkiller')).toBe(false);
    data.meds.find(m => m.id === 'lacrimmune')!.endDate = '2026-10-11';
    expect(buildRun(data, EYES_AM, t('08:00'))!.steps.map(s => s.name)).toEqual(['Hylogel']);
  });

  it('keeps a started run as it was when the routine is edited', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'given', t('09:00'));
    const routine = data.routines.find(r => r.id === 'eyes-am-pm')!;
    saveRoutine(data, { ...routine, steps: [routine.steps[0]] });
    expect(buildRun(data, EYES_AM, t('09:05'))!.steps).toHaveLength(2);
    expect(buildRun(data, runId('eyes-am-pm', DAY, '21:00'), t('09:05'))!.steps).toHaveLength(1);
  });

  it('keeps history of a deleted routine', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'given', t('09:00'));
    deleteRoutine(data, 'eyes-am-pm');
    const ids = listRuns(data, DAY, DAY, t('12:00')).map(r => r.id);
    expect(ids).toContain(EYES_AM);
    expect(ids).not.toContain(runId('eyes-am-pm', DAY, '21:00'));
  });

  it('finds what is due now and what comes next', () => {
    const data = setup();
    expect(dueSteps(data, t('09:01')).map(d => d.step.name)).toEqual(['Hylogel', 'Depon']);
    markStep(data, EYES_AM, 0, 'given', t('09:02'));
    const next = nextUpcoming(data, t('09:03'))!;
    expect(next.step.name).toBe('Lacrimmune');
    expect(next.step.dueAt).toBe(t('09:22'));
  });

  it('prunes old history', () => {
    const data = setup();
    markStep(data, runId('eyes-am-pm', '2026-01-01', '09:00'), 0, 'given', t('09:00', '2026-01-01'));
    markStep(data, EYES_AM, 0, 'given', t('09:00'));
    prune(data, t('12:00'));
    expect(Object.keys(data.runs)).toEqual([EYES_AM]);
  });

  it('round-trips notification ids', () => {
    expect(parseNotifId(stepNotifId(EYES_AM, 1))).toEqual({ runId: EYES_AM, index: 1 });
    expect(parseNotifId('something-else')).toBeNull();
  });
});

describe('notification plan', () => {
  it('schedules every first step ahead and nothing for chain steps yet', () => {
    const data = setup();
    data.settings.missAfterMin = 240; // so last night's doses are no longer due
    const plan = planNotifications(data, t('08:00'));
    const today = plan.alerts.filter(a => a.at < t('23:59'));
    expect(today.map(a => `${a.step.name}@${new Date(a.at).getHours()}`)).toEqual([
      'Hylogel@9',
      'Depon@9',
      'Hylogel@15',
      'Depon@15',
      'Hylogel@21',
      'Depon@21',
    ]);
    expect(plan.due).toEqual([]);
    // About a week ahead is covered.
    expect(plan.alerts.length).toBeGreaterThanOrEqual(6 * 7);
  });

  it('schedules the next medicine and a countdown once the first is given', () => {
    const data = setup();
    markStep(data, EYES_AM, 0, 'given', t('09:04'));
    const plan = planNotifications(data, t('09:05'));
    const lac = plan.alerts.find(a => a.notifId === stepNotifId(EYES_AM, 1))!;
    expect(lac.at).toBe(t('09:24'));
    expect(lac.kind).toBe('due');
    expect(plan.countdowns.map(c => c.notifId)).toEqual([`${stepNotifId(EYES_AM, 1)}~wait`]);
  });

  it('repeats an unanswered alert', () => {
    const data = setup();
    const plan = planNotifications(data, t('09:25'));
    const due = plan.due.find(d => d.run.id === EYES_AM)!;
    expect(due.lastAlertAt).toBe(t('09:20'));
    const repeat = plan.alerts.find(a => a.notifId === stepNotifId(EYES_AM, 0))!;
    expect(repeat).toMatchObject({ kind: 'repeat', at: t('09:30') });
  });

  it('rings again at most 6 times, then stays quietly', () => {
    const data = setup();
    const at = (min: number) => planNotifications(data, t('09:00') + min * MINUTE);
    expect(at(55).alerts.find(a => a.notifId === stepNotifId(EYES_AM, 0))?.at).toBe(t('10:00'));
    const after = at(61);
    expect(after.alerts.find(a => a.notifId === stepNotifId(EYES_AM, 0))).toBeUndefined();
    expect(after.due.find(d => d.run.id === EYES_AM)).toMatchObject({ visible: true, lastAlertAt: t('10:00') });
  });

  it('plans nothing while paused', () => {
    const data = setup();
    data.settings.paused = true;
    const plan = planNotifications(data, t('09:05'));
    expect(plan.alerts).toEqual([]);
    expect(plan.due).toEqual([]);
  });

  it('stops repeating when the dose counts as missed', () => {
    const data = setup();
    data.settings.missAfterMin = 30;
    const plan = planNotifications(data, t('09:25'));
    expect(plan.alerts.find(a => a.notifId === stepNotifId(EYES_AM, 0))).toBeUndefined();
  });

  it('respects a swipe when sticky is off, until the next repeat', () => {
    const data = setup();
    data.settings.sticky = false;
    data.dismissed[stepNotifId(EYES_AM, 0)] = t('09:22');
    expect(planNotifications(data, t('09:25')).due.find(d => d.run.id === EYES_AM)!.visible).toBe(false);
    expect(planNotifications(data, t('09:31')).due.find(d => d.run.id === EYES_AM)!.visible).toBe(true);
    data.settings.sticky = true;
    expect(planNotifications(data, t('09:25')).due.find(d => d.run.id === EYES_AM)!.visible).toBe(true);
  });

  it('plans nothing for a skipped run', () => {
    const data = setup();
    setRunSkipped(data, EYES_AM, true);
    const plan = planNotifications(data, t('08:00'));
    expect(plan.alerts.some(a => a.run.id === EYES_AM)).toBe(false);
  });
});

describe('migration from the old app', () => {
  const OLD = [
    {
      id: 'hylogel',
      groupTitle: 'Μάτια',
      name: 'Hylogel',
      body: 'Σταγόνες Hylogel - 1 σε κάθε μάτι',
      times: [9, 15, 21],
      enabled: true,
      chainAtHours: [9, 21],
      chain: [{ id: 'lacrimmune', name: 'Lacrimmune', body: 'Αλοιφή Lacrimmune', delayMinutes: 20 }],
    },
    { id: 'depon', groupTitle: 'Παυσίπονο', name: 'Depon', body: 'Depon - 1/4', times: [9, 15, 21], enabled: true },
  ];

  it('splits chains by hour into routines', () => {
    const data = migrateV2(OLD, t('08:00'));
    expect(data.meds.map(m => m.name)).toEqual(['Hylogel', 'Lacrimmune', 'Depon']);
    const summary = data.routines.map(r => ({
      name: r.name,
      times: r.times,
      steps: r.steps.map(s => `${data.meds.find(m => m.id === s.medId)!.name}+${s.waitMin}`),
    }));
    expect(summary).toEqual([
      { name: 'Μάτια', times: ['09:00', '21:00'], steps: ['Hylogel+0', 'Lacrimmune+20'] },
      { name: 'Μάτια (Hylogel)', times: ['15:00'], steps: ['Hylogel+0'] },
      { name: 'Παυσίπονο', times: ['09:00', '15:00', '21:00'], steps: ['Depon+0'] },
    ]);
  });

  it('follows per-step chain hours of longer chains', () => {
    const data = migrateV2(
      [
        {
          id: 'a',
          name: 'A',
          body: '',
          times: [8, 20],
          enabled: true,
          chainAtHours: [8, 20],
          chain: [
            { id: 'b', name: 'B', body: '', delayMinutes: 5, chainAtHours: [8] },
            { id: 'c', name: 'C', body: '', delayMinutes: 10 },
          ],
        },
      ],
      0,
    );
    expect(data.routines.map(r => [r.times, r.steps.length])).toEqual([
      [['08:00'], 3],
      [['20:00'], 2],
    ]);
  });
});
