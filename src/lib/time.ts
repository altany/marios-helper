import { lang, t } from '../i18n';

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

/**
 * The moment `hhmm` closest to `around` (at most 12 hours away), so a dose
 * planned at 23:00 and moved to "00:30" lands after midnight, not 22½ hours earlier.
 */
export const nearestAt = (key: string, hhmm: string, around: number): number => {
  const t = atTime(key, hhmm);
  if (t < around - 12 * 60 * MINUTE) return atTime(addDays(key, 1), hhmm);
  if (t > around + 12 * 60 * MINUTE) return atTime(addDays(key, -1), hhmm);
  return t;
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

// ── Labels (Greek or English) ─────────────────────────────────────────────────

export const dayNames = () =>
  t(
    ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'],
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  );
export const dayShort = () =>
  t(['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const monthsShort = () =>
  t(
    ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  );

/** "Τρίτη 13 Οκτ" / "Tuesday 13 Oct" */
export const formatDate = (key: string, withWeekday = true): string => {
  const d = parseDateKey(key);
  const base = `${d.getDate()} ${monthsShort()[d.getMonth()]}`;
  return withWeekday ? `${dayNames()[d.getDay()]} ${base}` : base;
};

/** "Σήμερα", "Αύριο", "Χθες" or "Τρίτη 13 Οκτ" (Today, Tomorrow, Yesterday). */
export const relativeDay = (key: string, today: string): string => {
  const diff = daysBetween(today, key);
  if (diff === 0) return t('Σήμερα', 'Today');
  if (diff === 1) return t('Αύριο', 'Tomorrow');
  if (diff === -1) return t('Χθες', 'Yesterday');
  return formatDate(key);
};

/** Like relativeDay, but further days count from today: "Σε 3 μέρες", "Πριν από 3 μέρες" (In 3 days, 3 days ago). */
export const fromToday = (key: string, today: string): string => {
  const diff = daysBetween(today, key);
  if (Math.abs(diff) <= 1) return relativeDay(key, today);
  return diff > 0 ? t(`Σε ${diff} μέρες`, `In ${diff} days`) : t(`Πριν από ${-diff} μέρες`, `${-diff} days ago`);
};

/** "20′", "1 ώρα", "1 ώρα 30′", "2 ώρες" / "20 min", "1 hr", "1 hr 30 min", "2 hrs" */
export const formatMinutes = (min: number): string => {
  const m = Math.round(min);
  if (m < 60) return t(`${m}′`, `${m} min`);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h === 1 ? t('1 ώρα', '1 hr') : t(`${h} ώρες`, `${h} hrs`);
  return rest ? `${hours} ${t(`${rest}′`, `${rest} min`)}` : hours;
};

/** Like formatMinutes, for small buttons: the same in Greek, "20m", "1h 30m" in English. */
export const formatMinutesShort = (min: number): string => {
  if (lang() === 'el') return formatMinutes(min);
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return [h ? `${h}h` : '', rest || !h ? `${rest}m` : ''].filter(Boolean).join(' ');
};

/**
 * "20 λεπτά", "1 ώρα και 30 λεπτά" / "20 minutes", "1 hour and 30 minutes":
 * plain words, for notifications (some watches can't show ′).
 */
export const formatMinutesWords = (min: number): string => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h === 0 ? '' : h === 1 ? t('1 ώρα', '1 hour') : t(`${h} ώρες`, `${h} hours`);
  const minutes = rest === 0 ? '' : rest === 1 ? t('1 λεπτό', '1 minute') : t(`${rest} λεπτά`, `${rest} minutes`);
  return [hours, minutes].filter(Boolean).join(t(' και ', ' and ')) || t('0 λεπτά', '0 minutes');
};

/** Human countdown/age, e.g. "σε 12′" or "πριν 1 ώρα 5′" / "in 12 min" or "1 hr 5 min ago". */
export const formatFromNow = (when: number, now: number): string => {
  const diff = Math.round((when - now) / MINUTE);
  if (diff === 0) return t('τώρα', 'now');
  return diff > 0
    ? t(`σε ${formatMinutes(diff)}`, `in ${formatMinutes(diff)}`)
    : t(`πριν ${formatMinutes(-diff)}`, `${formatMinutes(-diff)} ago`);
};
