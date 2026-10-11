import { RunView, StepView } from '../engine/runs';
import { formatMinutes, MINUTE, toHHMM } from '../lib/time';
import { AppData } from '../model/types';
import { ACCENT } from '../ui/theme';
import { CH_DOSE, CH_DOSE_QUIET, CH_WAIT } from './channels';
import { AndroidCategory, AndroidImportance, AndroidStyle, AndroidVisibility, Notification } from './driver';

export const ACTION_GIVE = 'give';
export const ACTION_SNOOZE = 'snooze';
export const IOS_CATEGORY = 'dose';
const SMALL_ICON = 'ic_stat_paw';
const LARGE_ICON = require('../../assets/images/mario-avatar.png');

/** Text describing the medicine that follows in the chain, if any. */
export const nextLine = (run: RunView, step: StepView) => {
  const next = run.steps[step.index + 1];
  if (!next) return '';
  return next.waitMin > 0 ? `Μετά: ${next.name} σε ${formatMinutes(next.waitMin)}` : `Μετά: ${next.name} αμέσως`;
};

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
  // Android removes it by itself once the dose counts as missed.
  const timeoutAfter = Math.max(MINUTE, step.dueAt + settings.missAfterMin * MINUTE - (opts.postAt ?? Date.now()));
  const med = step.med;
  const after = nextLine(run, step);
  const lines = [med?.dose, med?.notes, after].filter(Boolean) as string[];
  const subtitle = [run.routineName, toHHMM(step.dueAt)].filter(Boolean).join(' · ');
  const quiet = !!opts.quiet;

  return {
    id: step.notifId,
    title: `${settings.petName} · ${step.name}`,
    body: lines.join(' — ') || 'Ώρα για το φάρμακο',
    subtitle,
    data: { runId: run.id, index: String(step.index), kind: 'dose' },
    android: {
      channelId: quiet ? CH_DOSE_QUIET : CH_DOSE,
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
      style: { type: AndroidStyle.BIGTEXT, text: lines.join('\n') || 'Ώρα για το φάρμακο' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: '✓ Το έδωσα', pressAction: { id: ACTION_GIVE } },
        { title: `Αργότερα (${formatMinutes(settings.snoozeMin)})`, pressAction: { id: ACTION_SNOOZE } },
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
  title: `${step.name} στις ${toHHMM(step.dueAt)}`,
  body: `${after.name} δόθηκε στις ${toHHMM(after.markedAt ?? now)}. Θα ειδοποιηθείς για το ${step.name}.`,
  data: { runId: run.id, index: String(step.index), kind: 'wait', sig: String(step.dueAt) },
  android: {
    channelId: CH_WAIT,
    smallIcon: SMALL_ICON,
    color: step.med?.color ?? ACCENT,
    ongoing: true,
    autoCancel: false,
    onlyAlertOnce: true,
    showChronometer: true,
    chronometerDirection: 'down',
    timestamp: step.dueAt,
    timeoutAfter: Math.max(1000, step.dueAt - now),
    pressAction: { id: 'default', launchActivity: 'default' },
    actions: [{ title: '✓ Το έδωσα ήδη', pressAction: { id: ACTION_GIVE } }],
  },
});

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
