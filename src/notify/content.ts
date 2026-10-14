import { RunView, StepView } from '../engine/runs';
import { t } from '../i18n';
import { addDays, dateKey, formatDate, formatMinutes, formatMinutesWords, MINUTE, toHHMM } from '../lib/time';
import { AppData } from '../model/types';
import { ACCENT } from '../ui/theme';
import { CH_DONE, CH_DOSE_QUIET, CH_WAIT, doseChannel } from './channels';
import { AndroidCategory, AndroidImportance, AndroidStyle, AndroidVisibility, Notification } from './driver';

export const ACTION_GIVE = 'give';
export const ACTION_SNOOZE = 'snooze';
export const IOS_CATEGORY = 'dose';
const SMALL_ICON = 'ic_stat_paw';
const LARGE_ICON = require('../../assets/images/mario-avatar.png');
const BRAVO_PICTURE = require('../../assets/images/mario-bravo.jpg');

/** On Android, Notifee reads notification texts as HTML: escape our own words, and use <br> for new lines. */
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Text describing the medicine that follows in the chain, if any. */
export const nextLine = (run: RunView, step: StepView, format = formatMinutes) => {
  const next = run.steps[step.index + 1];
  if (!next) return '';
  return next.waitMin > 0
    ? t(`Μετά: ${next.name} σε ${format(next.waitMin)}`, `Next: ${next.name} in ${format(next.waitMin)}`)
    : t(`Μετά: ${next.name} αμέσως`, `Next: ${next.name} straight away`);
};

// Notification texts avoid symbols like ✓ or ′: some smartwatches can't show them.
// Bold and italics are fine: the watch gets the plain words.

/**
 * The notification for one medicine.
 * `quiet`: no sound (used when it is shown again). `postAt`: when it will appear.
 */
export const doseNotification = (
  data: AppData,
  run: RunView,
  step: StepView,
  opts: { quiet?: boolean; postAt?: number } = {},
): Notification & { id: string; data: Record<string, string> } => {
  const { settings } = data;
  const postAt = opts.postAt ?? Date.now();
  // Android removes it by itself once the dose counts as missed.
  const timeoutAfter = Math.max(MINUTE, step.dueAt + settings.missAfterMin * MINUTE - postAt);
  // Shown again a while later (a repeat, or brought back after a swipe): a gentle nudge.
  const late = postAt - step.dueAt >= 5 * MINUTE;
  const med = step.med;
  const after = nextLine(run, step, formatMinutesWords);
  const name = esc(step.name);
  const lines = [
    late ? t(`Ήταν για τις ${toHHMM(step.dueAt)}.`, `It was due at ${toHHMM(step.dueAt)}.`) : '',
    med?.dose ? `<b>${esc(med.dose)}</b>` : '',
    med?.notes ? esc(med.notes) : '',
    after ? `<i>${esc(after)}</i>` : '',
  ].filter(Boolean);
  const text = lines.join('<br>') || t('Ώρα για το φάρμακο', 'Time for the medicine');
  const subtitle = esc([run.routineName, toHHMM(step.dueAt)].filter(Boolean).join(' · '));
  const quiet = !!opts.quiet;

  return {
    id: step.notifId,
    title: late
      ? t(`Ξέχασες το ${name};`, `Did you forget ${name}?`)
      : t(`Ώρα για ${name}, ${esc(settings.petName)}!`, `Time for ${name}, ${esc(settings.petName)}!`),
    body: text,
    subtitle,
    data: { runId: run.id, index: String(step.index), kind: 'dose' },
    android: {
      channelId: quiet ? CH_DOSE_QUIET : doseChannel(settings),
      category: AndroidCategory.REMINDER,
      importance: quiet ? AndroidImportance.LOW : AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      circularLargeIcon: true,
      color: med?.color ?? ACCENT,
      ongoing: settings.sticky,
      timeoutAfter,
      autoCancel: false,
      loopSound: settings.insistent && !quiet,
      lightUpScreen: !quiet,
      showTimestamp: true,
      timestamp: step.dueAt,
      style: { type: AndroidStyle.BIGTEXT, text },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: t('Το έδωσα', 'I gave it'), pressAction: { id: ACTION_GIVE } },
        {
          title: t(
            `Αργότερα ${formatMinutesWords(settings.snoozeMin)}`,
            `Later ${formatMinutesWords(settings.snoozeMin)}`,
          ),
          pressAction: { id: ACTION_SNOOZE },
        },
      ],
    },
    ios: {
      categoryId: IOS_CATEGORY,
      sound: quiet ? undefined : 'default',
      interruptionLevel: 'timeSensitive',
      foregroundPresentationOptions: { banner: true, list: true, sound: !quiet },
    },
  };
};

/** Quiet notification with a timer counting down to the next medicine of a chain. */
export const countdownNotification = (
  data: AppData,
  run: RunView,
  step: StepView,
  after: StepView,
  now: number,
): Notification & { id: string; data: Record<string, string> } => ({
  id: `${step.notifId}~wait`,
  title: t(
    `Μπράβο! Το ${esc(after.name)} δόθηκε στις ${toHHMM(after.markedAt ?? now)}`,
    `Well done! ${esc(after.name)} given at ${toHHMM(after.markedAt ?? now)}`,
  ),
  body: t(`Επόμενο: ${esc(step.name)} στις ${toHHMM(step.dueAt)}`, `Next: ${esc(step.name)} at ${toHHMM(step.dueAt)}`),
  data: { runId: run.id, index: String(step.index), kind: 'wait', sig: String(step.dueAt) },
  android: {
    channelId: CH_WAIT,
    smallIcon: SMALL_ICON,
    largeIcon: LARGE_ICON,
    circularLargeIcon: true,
    color: step.med?.color ?? ACCENT,
    ongoing: true,
    autoCancel: false,
    onlyAlertOnce: true,
    showChronometer: true,
    chronometerDirection: 'down',
    timestamp: step.dueAt,
    timeoutAfter: Math.max(1000, step.dueAt - now),
    pressAction: { id: 'default', launchActivity: 'default' },
    actions: [{ title: t('Το έδωσα ήδη', 'Already gave it'), pressAction: { id: ACTION_GIVE } }],
  },
});

export const BRAVO_ID = 'bravo';

/** Shown once when the last dose of the day is given from a notification or the watch. */
export const bravoNotification = (
  data: AppData,
  next: { run: RunView; step: StepView } | null,
  now: number,
): Notification & { id: string } => {
  const day = next && dateKey(next.step.dueAt);
  const when =
    day === addDays(dateKey(now), 1)
      ? t('αύριο', 'tomorrow')
      : day === dateKey(now)
        ? t('σήμερα', 'today')
        : day && formatDate(day);
  const lines = [
    t('Πήρε όλα τα φάρμακα της μέρας.', 'All of today\'s medicines are given.'),
    next
      ? t(
          `Επόμενο: ${when} στις ${toHHMM(next.step.dueAt)}, ${esc(next.step.name)}`,
          `Next: ${when} at ${toHHMM(next.step.dueAt)}, ${esc(next.step.name)}`,
        )
      : '',
  ].filter(Boolean);
  return {
    id: BRAVO_ID,
    title: t(`Μπράβο ${esc(data.settings.petName)}!`, `Well done, ${esc(data.settings.petName)}!`),
    body: lines.join('<br>'),
    android: {
      channelId: CH_DONE,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      circularLargeIcon: true,
      color: ACCENT,
      timeoutAfter: 30 * MINUTE,
      pressAction: { id: 'default', launchActivity: 'default' },
      style: { type: AndroidStyle.BIGPICTURE, picture: BRAVO_PICTURE, largeIcon: null, summary: lines.join('<br>') },
    },
  };
};

/** Short text that changes whenever the scheduled notification needs to be replaced. */
export const signature = (n: Notification, at: number) =>
  JSON.stringify([
    at,
    n.title,
    n.body,
    n.android?.channelId,
    n.android?.ongoing,
    n.android?.loopSound,
    n.android?.timeoutAfter,
    n.android?.actions?.map(a => a.title),
  ]);
