// Small date helpers. Dates are stored as local "YYYY-MM-DD" keys and times of
// day as "HH:MM", so a schedule keeps meaning the same wall-clock time across
// daylight-saving changes.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (t: Date | number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, days: number): string => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / DAY);

/** Epoch ms for a local date key + "HH:MM". */
export const atTime = (key: string, hhmm: string): number => {
  const d = parseDateKey(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

export const toHHMM = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const hhmmToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToHHMM = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** First dose and every `hours` after it, within one day: ("07:00", 8) → 07:00, 15:00, 23:00. */
export const everyHours = (first: string, hours: number): string[] => {
  const start = hhmmToMinutes(first);
  const times: string[] = [];
  for (let m = start; m < start + 24 * 60; m += hours * 60) times.push(minutesToHHMM(m));
  return sortTimes(times);
};

export const isValidHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const weekday = (key: string) => parseDateKey(key).getDay();

export const sortTimes = (times: string[]) =>
  Array.from(new Set(times)).sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));

// ── Greek labels ──────────────────────────────────────────────────────────────

export const DAY_NAMES = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
export const DAY_SHORT = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
export const MONTHS = [
  'Ιανουαρίου',
  'Φεβρουαρίου',
  'Μαρτίου',
  'Απριλίου',
  'Μαΐου',
  'Ιουνίου',
  'Ιουλίου',
  'Αυγούστου',
  'Σεπτεμβρίου',
  'Οκτωβρίου',
  'Νοεμβρίου',
  'Δεκεμβρίου',
];
export const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

/** "Τρίτη 13 Οκτ" */
export const formatDate = (key: string, withWeekday = true): string => {
  const d = parseDateKey(key);
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return withWeekday ? `${DAY_NAMES[d.getDay()]} ${base}` : base;
};

/** "Σήμερα", "Αύριο", "Χθες" or "Τρίτη 13 Οκτ". */
export const relativeDay = (key: string, today: string): string => {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Σήμερα';
  if (diff === 1) return 'Αύριο';
  if (diff === -1) return 'Χθες';
  return formatDate(key);
};

/** "20′", "1 ώρα", "1 ώρα 30′", "2 ώρες" */
export const formatMinutes = (min: number): string => {
  const m = Math.round(min);
  if (m < 60) return `${m}′`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h === 1 ? '1 ώρα' : `${h} ώρες`;
  return rest ? `${hours} ${rest}′` : hours;
};

/** "20 λεπτά", "1 ώρα και 30 λεπτά" – plain words, for notifications (some watches can't show ′). */
export const formatMinutesWords = (min: number): string => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h === 0 ? '' : h === 1 ? '1 ώρα' : `${h} ώρες`;
  const minutes = rest === 0 ? '' : rest === 1 ? '1 λεπτό' : `${rest} λεπτά`;
  return [hours, minutes].filter(Boolean).join(' και ') || '0 λεπτά';
};

/** Human countdown/age, e.g. "σε 12′" or "πριν 1 ώρα 5′". */
export const formatFromNow = (t: number, now: number): string => {
  const diff = Math.round((t - now) / MINUTE);
  if (diff === 0) return 'τώρα';
  return diff > 0 ? `σε ${formatMinutes(diff)}` : `πριν ${formatMinutes(-diff)}`;
};
