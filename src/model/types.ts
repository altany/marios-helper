import type { LangSetting } from '../i18n';

export type MedKind = 'drops' | 'gel' | 'ointment' | 'pill' | 'liquid' | 'other';

/** A medicine from the vet's prescription. */
export interface Medication {
  id: string;
  name: string;
  kind: MedKind;
  /** How much and where, e.g. "1 σταγόνα σε κάθε μάτι". Shown in the notification. */
  dose: string;
  /** Extra instructions, e.g. "μασάζ στο βλέφαρο", "φύλαξη στο ψυγείο". */
  notes: string;
  color: string;
  /** First day of the treatment (YYYY-MM-DD), inclusive. */
  startDate?: string;
  /** Last day of the treatment (YYYY-MM-DD), inclusive. No reminders after it. */
  endDate?: string;
}

/** One medicine inside a routine. */
export interface RoutineStep {
  id: string;
  medId: string;
  /** Minutes to wait after the previous step was given. Ignored for the first step. */
  waitMin: number;
}

/**
 * A routine is a chain of medicines given one after the other, repeated at the
 * same times every day (or on chosen weekdays). Example:
 * 09:00 & 21:00 → Blinkdrops, then 20′ after it was given → Tearshield.
 */
export interface Routine {
  id: string;
  name: string;
  /** "HH:MM", sorted. */
  times: string[];
  /** 0 = Sunday … 6 = Saturday. Empty means every day. */
  days: number[];
  steps: RoutineStep[];
  enabled: boolean;
  /** Runs planned before this moment are not created (no alerts for the past). */
  createdAt: number;
  /** "HH:MM" → when that time was added to an existing routine. Same rule, per time. */
  timeAddedAt?: Record<string, number>;
  /**
   * Later times of the day count from when the previous time's dose was actually
   * given, keeping the planned gap (e.g. every 8 hours: 07:00 given at 08:22 →
   * next at 16:22, not 15:00). The first time of each day stays as planned.
   */
  fromGiven?: boolean;
}

export interface StepMark {
  status: 'given' | 'skipped';
  at: number;
}

export interface RunStep {
  stepId: string;
  medId: string;
  name: string;
  waitMin: number;
}

/**
 * What happened to one run of a routine (e.g. "Μάτια" on 12 Oct at 09:00).
 * Only stored once something happens to the run: it was moved, skipped or a
 * step was given/skipped/snoozed.
 */
export interface RunRecord {
  id: string;
  routineId: string;
  date: string;
  time: string;
  /** This run only: start at a different time. */
  startAt?: number;
  /** This run only: do not give. */
  skipped?: boolean;
  /** Steps frozen when the run was first acted on, so later edits don't change it. */
  steps?: RunStep[];
  /** step index → given / skipped */
  marks: Record<number, StepMark>;
  /** step index → new due time after "Αργότερα" */
  snoozed: Record<number, number>;
}

export interface Settings {
  /** All reminders on hold (e.g. Mario is staying at the vet). */
  paused: boolean;
  petName: string;
  /** Minutes for the "Αργότερα" button on the notification. */
  snoozeMin: number;
  /** Alert again every N minutes until answered (at most MAX_REPEATS times). 0 = off. */
  repeatMin: number;
  /** A dose with no answer after this many minutes counts as missed. */
  missAfterMin: number;
  /** Notification comes back if swiped away. */
  sticky: boolean;
  /** Quiet countdown notification while waiting for the next medicine of a chain. */
  countdown: boolean;
  /** Sound keeps playing until the notification is looked at. */
  insistent: boolean;
  /** The dose notification barks instead of the phone's usual sound. */
  bark: boolean;
  /** App language: the phone's ('auto'), Greek or English. */
  language: LangSetting;
}

export interface Prescription {
  vetName: string;
  vetPhone: string;
  /** Next check-up (YYYY-MM-DD). */
  nextVisit?: string;
  notes: string;
}

export interface AppData {
  version: 3;
  meds: Medication[];
  routines: Routine[];
  runs: Record<string, RunRecord>;
  settings: Settings;
  prescription: Prescription;
  /** notification id → time it was swiped away (only used when sticky is off). */
  dismissed: Record<string, number>;
}
