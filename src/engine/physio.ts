import { addDays, atTime, DAY, dateKey, HOUR, MINUTE } from '../lib/time';
import { AppData, Appointment } from '../model/types';

// Physio: exercises at home once a day, and visits to the physio.
// Pure functions, like runs.ts.

/** "Αργότερα" on the physio reminder. */
export const PHYSIO_SNOOZE_MIN = 60;

/** The reminder for a visit comes this long before it. */
export const APPT_REMIND_MIN = 60;

/** A visit still counts as coming up until this long after it starts. */
const APPT_LENGTH = HOUR;

export const physioNotifId = (date: string) => `physio|${date}`;
export const apptNotifId = (id: string) => `appt|${id}`;
export const isPhysioNotif = (id: string) => /^(physio|appt)\|/.test(id);

export type PhysioStatus =
  | 'done'
  /** Today, the reminder time has come. */
  | 'due'
  /** Today before the reminder time, or a day still to come. */
  | 'upcoming'
  /** A past day that wasn't marked done. */
  | 'missed'
  /** Daily exercises are off (or weren't on yet that day). */
  | 'off';

export interface PhysioDayView {
  date: string;
  status: PhysioStatus;
  /** When the reminder comes (or came). */
  dueAt: number;
  doneAt?: number;
  /** Moved with "Αργότερα". */
  snoozed: boolean;
  notifId: string;
}

export const physioDay = (data: AppData, date: string, now: number): PhysioDayView => {
  const p = data.physio;
  const done = p.done[date];
  const snoozed = done ? undefined : p.snoozed[date];
  const dueAt = snoozed ?? atTime(date, p.time);
  const today = dateKey(now);
  let status: PhysioStatus;
  if (done) status = 'done';
  else if (!p.daily || (p.since != null && date < p.since)) status = 'off';
  else if (date < today) status = 'missed';
  else if (date === today && now >= dueAt) status = 'due';
  else status = 'upcoming';
  return { date, status, dueAt, doneAt: done?.at, snoozed: snoozed != null, notifId: physioNotifId(date) };
};

/** Days in a row with the exercises done. Today only counts once done; not yet done today doesn't break it. */
export const physioStreak = (data: AppData, now: number) => {
  let day = dateKey(now);
  if (!data.physio.done[day]) day = addDays(day, -1);
  let n = 0;
  while (data.physio.done[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
};

const byTime = (data: AppData) => [...data.physio.appointments].sort((a, b) => a.at - b.at);

/** Visits not over yet, soonest first. */
export const upcomingAppointments = (data: AppData, now: number) => byTime(data).filter(a => a.at + APPT_LENGTH > now);

/** Visits already over, latest first. */
export const pastAppointments = (data: AppData, now: number) =>
  byTime(data)
    .filter(a => a.at + APPT_LENGTH <= now)
    .reverse();

export const appointmentsOn = (data: AppData, date: string) => byTime(data).filter(a => dateKey(a.at) === date);

export interface PhysioAlert {
  notifId: string;
  /** When Android should show it. */
  at: number;
  /** Daily reminder, or reminder for a visit. */
  day?: PhysioDayView;
  appt?: Appointment;
}

export interface PhysioPlan {
  alerts: PhysioAlert[];
  /** Today's reminder, once its time has come and the exercises aren't done. */
  due: { day: PhysioDayView; visible: boolean } | null;
  /** Visit reminders that may stay in the notification drawer (between the reminder and the visit). */
  keep: string[];
}

export const planPhysio = (data: AppData, now: number, horizonDays: number): PhysioPlan => {
  const plan: PhysioPlan = { alerts: [], due: null, keep: [] };
  if (data.settings.paused) return plan;
  const today = dateKey(now);

  if (data.physio.daily) {
    for (let i = 0; i <= horizonDays; i++) {
      const day = physioDay(data, addDays(today, i), now);
      if (day.status === 'upcoming') plan.alerts.push({ notifId: day.notifId, at: day.dueAt, day });
    }
    const day = physioDay(data, today, now);
    if (day.status === 'due') {
      const dismissedAt = data.dismissed[day.notifId];
      const visible = data.settings.sticky || dismissedAt == null || dismissedAt < day.dueAt;
      plan.due = { day, visible };
    }
  }

  for (const appt of data.physio.appointments) {
    const notifId = apptNotifId(appt.id);
    const remindAt = appt.at - APPT_REMIND_MIN * MINUTE;
    if (remindAt > now && remindAt <= now + horizonDays * DAY) plan.alerts.push({ notifId, at: remindAt, appt });
    else if (remindAt <= now && now < appt.at) plan.keep.push(notifId);
  }
  return plan;
};

// ── Changes (each edits a draft copy, see store.update) ──────────────────

export const markPhysio = (data: AppData, date: string, at: number) => {
  data.physio.done[date] = { at };
  delete data.physio.snoozed[date];
};

export const unmarkPhysio = (data: AppData, date: string) => {
  delete data.physio.done[date];
};

/** "Αργότερα": at most until the end of that day. */
export const snoozePhysio = (data: AppData, date: string, until: number) => {
  data.physio.snoozed[date] = Math.min(until, atTime(date, '23:59'));
};

export const setPhysioDaily = (data: AppData, daily: boolean, today: string) => {
  if (daily && !data.physio.daily) data.physio.since = today;
  data.physio.daily = daily;
};

/** A new reminder time replaces any "Αργότερα". */
export const setPhysioTime = (data: AppData, time: string) => {
  data.physio.time = time;
  data.physio.snoozed = {};
};

export const saveAppointment = (data: AppData, appt: Appointment) => {
  const i = data.physio.appointments.findIndex(a => a.id === appt.id);
  if (i >= 0) data.physio.appointments[i] = appt;
  else data.physio.appointments.push(appt);
};

export const deleteAppointment = (data: AppData, id: string) => {
  data.physio.appointments = data.physio.appointments.filter(a => a.id !== id);
};

/** Drops days and visits older than `keepDays`, and old "Αργότερα". */
export const prunePhysio = (data: AppData, now: number, keepDays = 400) => {
  const today = dateKey(now);
  const oldest = addDays(today, -keepDays);
  for (const date of Object.keys(data.physio.done)) if (date < oldest) delete data.physio.done[date];
  for (const date of Object.keys(data.physio.snoozed)) if (date < today) delete data.physio.snoozed[date];
  data.physio.appointments = data.physio.appointments.filter(a => dateKey(a.at) >= oldest);
};
