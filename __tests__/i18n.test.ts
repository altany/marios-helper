// Dates and durations in both languages.

import { setLanguage, t } from '../src/i18n';
import {
  formatDate,
  formatFromNow,
  formatMinutes,
  formatMinutesShort,
  formatMinutesWords,
  MINUTE,
  relativeDay,
} from '../src/lib/time';

afterAll(() => setLanguage('el'));

it('writes Greek', () => {
  setLanguage('el');
  expect(t('Σήμερα', 'Today')).toBe('Σήμερα');
  expect(formatMinutes(20)).toBe('20′');
  expect(formatMinutes(90)).toBe('1 ώρα 30′');
  expect(formatMinutesShort(90)).toBe('1 ώρα 30′');
  expect(formatMinutesWords(61)).toBe('1 ώρα και 1 λεπτό');
  expect(formatFromNow(12 * MINUTE, 0)).toBe('σε 12′');
  expect(relativeDay('2026-10-13', '2026-10-12')).toBe('Αύριο');
  expect(formatDate('2026-10-13')).toBe('Τρίτη 13 Οκτ');
});

it('writes English', () => {
  setLanguage('en');
  expect(t('Σήμερα', 'Today')).toBe('Today');
  expect(formatMinutes(20)).toBe('20 min');
  expect(formatMinutes(90)).toBe('1 hr 30 min');
  expect(formatMinutes(120)).toBe('2 hrs');
  expect(formatMinutesShort(10)).toBe('10m');
  expect(formatMinutesShort(90)).toBe('1h 30m');
  expect(formatMinutesWords(61)).toBe('1 hour and 1 minute');
  expect(formatFromNow(0, 65 * MINUTE)).toBe('1 hr 5 min ago');
  expect(relativeDay('2026-10-11', '2026-10-12')).toBe('Yesterday');
  expect(formatDate('2026-10-13')).toBe('Tuesday 13 Oct');
});
