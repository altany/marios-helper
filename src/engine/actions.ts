import { addDays, dateKey } from '../lib/time';
import { AppData, Medication, Routine, RunRecord } from '../model/types';
import { buildRun, emptyRecord, runsForDay, stepsFor } from './runs';

// Changes to the data. Each function edits a draft copy (see store.update).

const record = (data: AppData, runId: string): RunRecord => {
  let rec = data.runs[runId];
  if (!rec) {
    rec = emptyRecord(runId);
    data.runs[runId] = rec;
  }
  return rec;
};

/** Freeze the medicines of a run once it starts, so editing the routine doesn't change it halfway. */
const freeze = (data: AppData, rec: RunRecord) => {
  if (rec.steps) return;
  const routine = data.routines.find(r => r.id === rec.routineId);
  rec.steps = routine ? stepsFor(data, routine, rec.date) : [];
};

/** Removes records that no longer hold anything. */
const tidy = (data: AppData, runId: string) => {
  const rec = data.runs[runId];
  if (
    rec &&
    !rec.skipped &&
    rec.startAt == null &&
    Object.keys(rec.marks).length === 0 &&
    Object.keys(rec.snoozed).length === 0
  ) {
    delete data.runs[runId];
  }
};

export const markStep = (data: AppData, runId: string, index: number, status: 'given' | 'skipped', at: number) => {
  const rec = record(data, runId);
  freeze(data, rec);
  rec.marks[index] = { status, at };
  delete rec.snoozed[index];
};

/** Undo "given"/"skipped" for a step. Later steps of the chain are reset too. */
export const unmarkStep = (data: AppData, runId: string, index: number) => {
  const rec = data.runs[runId];
  if (!rec) return;
  for (const key of Object.keys(rec.marks)) if (Number(key) >= index) delete rec.marks[Number(key)];
  for (const key of Object.keys(rec.snoozed)) if (Number(key) > index) delete rec.snoozed[Number(key)];
  tidy(data, runId);
};

export const snoozeStep = (data: AppData, runId: string, index: number, until: number) => {
  const rec = record(data, runId);
  freeze(data, rec);
  rec.snoozed[index] = until;
};

/** Change the time of one run only. */
export const moveRun = (data: AppData, runId: string, startAt: number) => {
  const rec = record(data, runId);
  rec.startAt = startAt;
  delete rec.snoozed[0];
  tidy(data, runId);
};

export const resetRunTime = (data: AppData, runId: string) => {
  const rec = data.runs[runId];
  if (!rec) return;
  delete rec.startAt;
  delete rec.snoozed[0];
  tidy(data, runId);
};

export const setRunSkipped = (data: AppData, runId: string, skipped: boolean) => {
  const rec = record(data, runId);
  if (skipped) rec.skipped = true;
  else delete rec.skipped;
  tidy(data, runId);
};

/** Move every run of a day that hasn't started yet by `minutes` (e.g. "we woke up late"). */
export const shiftDay = (data: AppData, date: string, minutes: number, now: number) => {
  for (const run of runsForDay(data, date, now)) {
    const started = run.skipped || run.steps.some(s => s.markedAt != null);
    if (started || (run.status !== 'upcoming' && run.status !== 'active')) continue;
    moveRun(data, run.id, run.startAt + minutes * 60_000);
  }
};

export const saveRoutine = (data: AppData, routine: Routine) => {
  const i = data.routines.findIndex(r => r.id === routine.id);
  if (i >= 0) data.routines[i] = routine;
  else data.routines.push(routine);
};

export const deleteRoutine = (data: AppData, id: string) => {
  data.routines = data.routines.filter(r => r.id !== id);
};

export const saveMed = (data: AppData, med: Medication) => {
  const i = data.meds.findIndex(m => m.id === med.id);
  if (i >= 0) data.meds[i] = med;
  else data.meds.push(med);
};

/** Deletes a medicine and takes it out of every routine. */
export const deleteMed = (data: AppData, id: string) => {
  data.meds = data.meds.filter(m => m.id !== id);
  for (const r of data.routines) {
    r.steps = r.steps.filter(s => s.medId !== id);
  }
};

/** Drops history older than `keepDays` and stale swipe records. */
export const prune = (data: AppData, now: number, keepDays = 120) => {
  const oldest = addDays(dateKey(now), -keepDays);
  for (const [id, rec] of Object.entries(data.runs)) {
    if (rec.date < oldest) delete data.runs[id];
  }
  for (const [id, at] of Object.entries(data.dismissed)) {
    if (now - at > 2 * 24 * 3600_000) delete data.dismissed[id];
  }
};

/** Is this step the one the user can act on now (or ahead of time)? */
export const canGive = (data: AppData, runId: string, index: number, now: number) => {
  const run = buildRun(data, runId, now);
  const step = run?.steps[index];
  return !!step && (step.status === 'due' || step.status === 'upcoming' || step.status === 'missed');
};
