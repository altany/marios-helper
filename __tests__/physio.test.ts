import { prune } from '../src/engine/actions';
import {
  apptNotifId,
  markPhysio,
  pastAppointments,
  physioDay,
  physioNotifId,
  physioStreak,
  planPhysio,
  saveAppointment,
  setPhysioDaily,
  setPhysioTime,
  snoozePhysio,
  upcomingAppointments,
} from '../src/engine/physio';
import { addDays, atTime, MINUTE } from '../src/lib/time';
import { normalize } from '../src/model/migrate';
import { AppData } from '../src/model/types';
import { sampleData } from './fixtures';

const DAY = '2026-10-12';
const t = (hhmm: string, day = DAY) => atTime(day, hhmm);

/** Mario's schedule with daily physio at 18:00, turned on two days before DAY. */
const setup = (): AppData => {
  const data = sampleData(t('08:00', '2026-10-10'));
  setPhysioDaily(data, true, '2026-10-10');
  return data;
};

describe('daily physio', () => {
  it('is off until turned on', () => {
    const data = sampleData(t('08:00'));
    expect(physioDay(data, DAY, t('19:00')).status).toBe('off');
    expect(planPhysio(data, t('08:00'), 7).alerts).toEqual([]);
  });

  it('waits for the reminder time, then is due', () => {
    const data = setup();
    expect(physioDay(data, DAY, t('17:59')).status).toBe('upcoming');
    expect(physioDay(data, DAY, t('18:00')).status).toBe('due');
    expect(physioDay(data, '2026-10-13', t('18:00')).status).toBe('upcoming');
  });

  it('counts a past day not marked done as missed, but not days before it was turned on', () => {
    const data = setup();
    expect(physioDay(data, '2026-10-11', t('09:00')).status).toBe('missed');
    expect(physioDay(data, '2026-10-09', t('09:00')).status).toBe('off');
  });

  it('can be done before the reminder, and then no reminder comes that day', () => {
    const data = setup();
    markPhysio(data, DAY, t('10:30'));
    const day = physioDay(data, DAY, t('19:00'));
    expect(day.status).toBe('done');
    expect(day.doneAt).toBe(t('10:30'));
    const plan = planPhysio(data, t('10:31'), 7);
    expect(plan.alerts.map(a => a.notifId)).not.toContain(physioNotifId(DAY));
    expect(plan.alerts[0].at).toBe(t('18:00', '2026-10-13'));
    expect(plan.alerts).toHaveLength(7);
  });

  it('reminds every day for a week, and keeps the reminder in the drawer once due', () => {
    const data = setup();
    expect(planPhysio(data, t('08:00'), 7).alerts.map(a => a.at)).toEqual(
      Array.from({ length: 8 }, (_, i) => t('18:00', addDays(DAY, i))),
    );
    const plan = planPhysio(data, t('18:30'), 7);
    expect(plan.due?.day.notifId).toBe(physioNotifId(DAY));
    expect(plan.due?.visible).toBe(true);
  });

  it('"Αργότερα" moves the reminder, but not past the end of the day', () => {
    const data = setup();
    snoozePhysio(data, DAY, t('19:00'));
    expect(physioDay(data, DAY, t('18:30')).status).toBe('upcoming');
    expect(planPhysio(data, t('18:30'), 7).alerts[0].at).toBe(t('19:00'));
    snoozePhysio(data, DAY, t('00:30', '2026-10-13'));
    expect(physioDay(data, DAY, t('23:00')).dueAt).toBe(t('23:59'));
    setPhysioTime(data, '20:00');
    expect(physioDay(data, DAY, t('19:00')).dueAt).toBe(t('20:00'));
  });

  it('stays away after a swipe when sticky reminders are off', () => {
    const data = setup();
    data.settings.sticky = false;
    data.dismissed[physioNotifId(DAY)] = t('18:05');
    expect(planPhysio(data, t('18:10'), 7).due?.visible).toBe(false);
  });

  it('says nothing while reminders are paused', () => {
    const data = setup();
    data.settings.paused = true;
    const plan = planPhysio(data, t('18:30'), 7);
    expect(plan.alerts).toEqual([]);
    expect(plan.due).toBeNull();
  });

  it('counts the days in a row', () => {
    const data = setup();
    markPhysio(data, '2026-10-10', t('18:00', '2026-10-10'));
    markPhysio(data, '2026-10-11', t('18:00', '2026-10-11'));
    expect(physioStreak(data, t('09:00'))).toBe(2); // not done yet today: still 2
    markPhysio(data, DAY, t('09:30'));
    expect(physioStreak(data, t('09:30'))).toBe(3);
    expect(physioStreak(data, t('09:00', '2026-10-14'))).toBe(0); // 13 Oct was missed
  });

  it('starts counting again from the day it is turned back on', () => {
    const data = setup();
    setPhysioDaily(data, false, '2026-10-11');
    setPhysioDaily(data, true, DAY);
    expect(physioDay(data, '2026-10-11', t('09:00')).status).toBe('off');
  });
});

describe('physio appointments', () => {
  const visit = { id: 'v1', at: t('17:30', '2026-10-14'), note: 'Υδροθεραπεία' };

  it('reminds an hour before', () => {
    const data = setup();
    saveAppointment(data, visit);
    const alert = planPhysio(data, t('08:00'), 7).alerts.find(a => a.notifId === apptNotifId('v1'));
    expect(alert?.at).toBe(t('16:30', '2026-10-14'));
  });

  it('keeps the reminder in the drawer until the visit starts', () => {
    const data = setup();
    saveAppointment(data, visit);
    expect(planPhysio(data, t('16:45', '2026-10-14'), 7).keep).toEqual([apptNotifId('v1')]);
    expect(planPhysio(data, t('17:31', '2026-10-14'), 7).keep).toEqual([]);
  });

  it('lists coming and past visits', () => {
    const data = setup();
    saveAppointment(data, visit);
    saveAppointment(data, { id: 'v0', at: t('17:30', '2026-10-07'), note: '' });
    saveAppointment(data, { id: 'v2', at: t('17:30', '2026-10-21'), note: '' });
    expect(upcomingAppointments(data, t('09:00')).map(a => a.id)).toEqual(['v1', 'v2']);
    expect(pastAppointments(data, t('09:00')).map(a => a.id)).toEqual(['v0']);
    // During the visit it still counts as coming up.
    expect(upcomingAppointments(data, t('18:00', '2026-10-14'))[0].id).toBe('v1');
  });

  it('updates a visit instead of adding it twice', () => {
    const data = setup();
    saveAppointment(data, visit);
    saveAppointment(data, { ...visit, note: 'Υδροθεραπεία, φέρε πετσέτα' });
    expect(data.physio.appointments).toEqual([{ ...visit, note: 'Υδροθεραπεία, φέρε πετσέτα' }]);
  });
});

describe('physio data', () => {
  it('is added to data saved before physio existed', () => {
    const old = sampleData(t('08:00')) as Partial<AppData>;
    delete old.physio;
    const data = normalize(old as AppData);
    expect(data.physio).toEqual({ daily: false, time: '18:00', done: {}, snoozed: {}, appointments: [] });
  });

  it('keeps about a year of history', () => {
    const data = setup();
    markPhysio(data, '2025-01-05', t('18:00', '2025-01-05'));
    markPhysio(data, '2026-01-05', t('18:00', '2026-01-05'));
    snoozePhysio(data, '2026-10-11', t('19:00', '2026-10-11'));
    prune(data, t('09:00'));
    expect(Object.keys(data.physio.done)).toEqual(['2026-01-05']);
    expect(data.physio.snoozed).toEqual({});
  });

  it('turning it on remembers the day', () => {
    const data = sampleData(t('08:00'));
    setPhysioDaily(data, true, DAY);
    expect(data.physio.since).toBe(DAY);
    setPhysioDaily(data, true, '2026-10-20'); // already on: unchanged
    expect(data.physio.since).toBe(DAY);
    expect(physioDay(data, DAY, t('18:00') + MINUTE).status).toBe('due');
  });
});
