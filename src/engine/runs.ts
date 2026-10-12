import { addDays, atTime, dateKey, MINUTE, weekday } from '../lib/time';
import { AppData, Medication, Routine, RunRecord, RunStep } from '../model/types';

// Turns routines + run records into concrete "runs" for given days, working out
// when each medicine is due. Pure functions: easy to test, no side effects.

export type StepStatus =
  | 'given'
  | 'skipped'
  /** Time has come, waiting for an answer. */
  | 'due'
  /** Scheduled for later. */
  | 'upcoming'
  /** Waits for the previous medicine of the chain to be given. */
  | 'waiting'
  /** Nobody answered in time. */
  | 'missed';

export interface StepView {
  index: number;
  stepId: string;
  medId: string;
  med?: Medication;
  name: string;
  waitMin: number;
  status: StepStatus;
  /** When it is due. For 'waiting' steps this is an estimate. */
  dueAt: number;
  /** When it was given/skipped. */
  markedAt?: number;
  snoozed: boolean;
  /** Notification id for this step. */
  notifId: string;
}

export type RunStatus = 'upcoming' | 'active' | 'done' | 'skipped' | 'missed';

export interface RunView {
  id: string;
  routineId: string;
  routineName: string;
  date: string;
  time: string;
  plannedAt: number;
  startAt: number;
  moved: boolean;
  skipped: boolean;
  steps: StepView[];
  status: RunStatus;
  givenCount: number;
}

export const runId = (routineId: string, date: string, time: string) => `${routineId}|${date}|${time}`;

export const parseRunId = (id: string) => {
  const [routineId, date, time] = id.split('|');
  return { routineId, date, time };
};

export const stepNotifId = (id: string, index: number) => `${id}#${index}`;

export const parseNotifId = (notifId: string): { runId: string; index: number } | null => {
  const m = /^(.+\|\d{4}-\d{2}-\d{2}\|\d{2}:\d{2})#(\d+)$/.exec(notifId);
  return m ? { runId: m[1], index: Number(m[2]) } : null;
};

export const isMedActiveOn = (med: Medication, date: string) =>
  (!med.startDate || date >= med.startDate) && (!med.endDate || date <= med.endDate);

export const routineRunsOn = (r: Routine, date: string) =>
  r.enabled && (r.days.length === 0 || r.days.includes(weekday(date)));

/** The steps a run of `routine` on `date` would have (medicines not active that day are left out). */
export const stepsFor = (data: AppData, routine: Routine, date: string): RunStep[] => {
  const out: RunStep[] = [];
  for (const s of routine.steps) {
    const med = data.meds.find(m => m.id === s.medId);
    if (!med || !isMedActiveOn(med, date)) continue;
    out.push({ stepId: s.id, medId: med.id, name: med.name, waitMin: out.length === 0 ? 0 : s.waitMin });
  }
  return out;
};

export const emptyRecord = (id: string): RunRecord => {
  const { routineId, date, time } = parseRunId(id);
  return { id, routineId, date, time, marks: {}, snoozed: {} };
};

export const buildRun = (
  data: AppData,
  id: string,
  now: number,
  record: RunRecord | undefined = data.runs[id],
): RunView | null => {
  const { routineId, date, time } = parseRunId(id);
  const routine = data.routines.find(r => r.id === routineId);
  const steps = record?.steps ?? (routine ? stepsFor(data, routine, date) : []);
  if (steps.length === 0) return null;

  const missAfter = data.settings.missAfterMin * MINUTE;
  const plannedAt = atTime(date, time);
  const startAt = record?.startAt ?? plannedAt;
  const skipped = !!record?.skipped;
  const marks = record?.marks ?? {};
  const snoozed = record?.snoozed ?? {};

  const views: StepView[] = [];
  steps.forEach((s, i) => {
    const prev = views[i - 1];
    const mark = marks[i];
    let dueAt: number;
    let ready: boolean;
    if (!prev) {
      dueAt = startAt;
      ready = true;
    } else if (prev.markedAt != null) {
      // The wait counts from when the previous medicine was actually given.
      // If it was skipped, the next one is due straight away.
      dueAt = prev.markedAt + (prev.status === 'given' ? s.waitMin * MINUTE : 0);
      ready = true;
    } else {
      dueAt = prev.dueAt + s.waitMin * MINUTE;
      ready = false;
    }
    if (ready && snoozed[i] != null) dueAt = snoozed[i];

    let status: StepStatus;
    if (mark) status = mark.status;
    else if (skipped) status = 'skipped';
    else if (!ready) status = prev && prev.status === 'missed' ? 'missed' : 'waiting';
    else if (now >= dueAt + missAfter) status = 'missed';
    else if (now >= dueAt) status = 'due';
    else status = 'upcoming';

    views.push({
      index: i,
      stepId: s.stepId,
      medId: s.medId,
      med: data.meds.find(m => m.id === s.medId),
      name: data.meds.find(m => m.id === s.medId)?.name ?? s.name,
      waitMin: s.waitMin,
      status,
      dueAt,
      markedAt: mark?.at,
      snoozed: ready && snoozed[i] != null && !mark,
      notifId: stepNotifId(id, i),
    });
  });

  const has = (st: StepStatus) => views.some(v => v.status === st);
  let status: RunStatus;
  if (views.every(v => v.status === 'skipped')) status = 'skipped';
  else if (views.every(v => v.status === 'given' || v.status === 'skipped')) status = 'done';
  else if (has('due')) status = 'active';
  else if (has('upcoming') || has('waiting')) {
    status = views.some(v => v.markedAt != null) ? 'active' : 'upcoming';
  } else status = 'missed';

  return {
    id,
    routineId,
    routineName: routine?.name ?? '',
    date,
    time,
    plannedAt,
    startAt,
    moved: record?.startAt != null && record.startAt !== plannedAt,
    skipped,
    steps: views,
    status,
    givenCount: views.filter(v => v.status === 'given').length,
  };
};

/** All runs on the days from `from` to `to` (inclusive), sorted by start time. */
export const listRuns = (data: AppData, from: string, to: string, now: number): RunView[] => {
  const ids = new Set<string>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const r of data.routines) {
      if (!routineRunsOn(r, d)) continue;
      for (const t of r.times) {
        const id = runId(r.id, d, t);
        // No runs from before the routine (or this time of it) existed: no alerts for the past.
        if (!data.runs[id] && atTime(d, t) < Math.max(r.createdAt, r.timeAddedAt?.[t] ?? 0)) continue;
        ids.add(id);
      }
    }
  }
  // Runs that were acted on but are no longer in the schedule (routine edited or
  // deleted) are kept so the history stays complete.
  for (const rec of Object.values(data.runs)) {
    if (rec.date < from || rec.date > to || ids.has(rec.id)) continue;
    if (Object.keys(rec.marks).length > 0) ids.add(rec.id);
  }

  const runs: RunView[] = [];
  for (const id of ids) {
    const run = buildRun(data, id, now);
    if (run) runs.push(run);
  }
  return runs.sort((a, b) => a.startAt - b.startAt || a.routineName.localeCompare(b.routineName));
};

export const runsForDay = (data: AppData, date: string, now: number) => listRuns(data, date, date, now);

/** Every step that needs attention right now, oldest first. */
export const dueSteps = (data: AppData, now: number) => {
  const missAfterDays = Math.ceil(data.settings.missAfterMin / (24 * 60)) + 1;
  const today = dateKey(now);
  return listRuns(data, addDays(today, -missAfterDays), today, now)
    .flatMap(run => run.steps.filter(s => s.status === 'due').map(step => ({ run, step })))
    .sort((a, b) => a.step.dueAt - b.step.dueAt);
};

/** True when every dose of the day has been answered and at least one was given. */
export const dayDone = (data: AppData, date: string, now: number) => {
  const steps = runsForDay(data, date, now).flatMap(run => run.steps);
  return steps.some(s => s.status === 'given') && steps.every(s => s.status === 'given' || s.status === 'skipped');
};

/** Next thing that will happen (first upcoming step from now on). */
export const nextUpcoming = (data: AppData, now: number, days = 7) => {
  const today = dateKey(now);
  let best: { run: RunView; step: StepView } | null = null;
  for (const run of listRuns(data, addDays(today, -1), addDays(today, days), now)) {
    for (const step of run.steps) {
      if (step.status === 'upcoming' && (!best || step.dueAt < best.step.dueAt)) best = { run, step };
    }
  }
  return best;
};
