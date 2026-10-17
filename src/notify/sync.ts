import { Platform } from 'react-native';
import { isPhysioNotif } from '../engine/physio';
import { planNotifications } from '../engine/plan';
import { parseNotifId } from '../engine/runs';
import { MINUTE } from '../lib/time';
import { getData } from '../store/store';
import {
  appointmentNotification,
  countdownNotification,
  doseNotification,
  physioNotification,
  signature,
} from './content';
import notifee, { AlarmType, AndroidNotificationSetting, TriggerType } from './driver';
import { clock, log } from './log';

// Makes Android's scheduled and shown notifications match the plan:
//  - one alarm per medicine that is coming up (or the next repeat of one that is due),
//  - due medicines stay visible until answered,
//  - the same for the daily physio reminder (until the end of the day), and a
//    reminder before each physio visit,
//  - everything else of ours is removed.
// It is safe to call any time; it only changes what differs.

const isOurs = (id: string | undefined): id is string =>
  !!id && (parseNotifId(id.replace(/~wait$/, '')) != null || isPhysioNotif(id));

let running: Promise<void> | null = null;
let again = false;
/** Why the next sync runs (for the notification log). */
let reasons: string[] = [];

export const syncNotifications = (reason = 'other'): Promise<void> => {
  reasons.push(reason);
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const why = reasons.join(', ');
      reasons = [];
      try {
        await syncOnce(why);
      } catch (e) {
        console.warn('Notification sync failed', e);
        void log(`sync failed: ${String(e)}`);
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
};

/**
 * Exact alarms if allowed. Without the "exact alarms" permission the library would
 * drop exact alarms, so fall back to inexact ones (may be a few minutes late).
 */
export const alarmType = async () => {
  if (Platform.OS !== 'android') return AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE;
  const settings = await notifee.getNotificationSettings();
  return settings.android?.alarm === AndroidNotificationSetting.DISABLED
    ? AlarmType.SET_AND_ALLOW_WHILE_IDLE
    : AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE;
};

const syncOnce = async (why: string) => {
  const data = await getData();
  const now = Date.now();
  const plan = planNotifications(data, now);
  const type = await alarmType();

  // 1. Scheduled alarms
  const wanted = new Map<string, { notification: ReturnType<typeof doseNotification>; at: number }>();
  const want = (notification: ReturnType<typeof doseNotification>, at: number) => {
    notification.data.sig = signature(notification, at);
    wanted.set(notification.id, { notification, at });
  };
  for (const alert of plan.alerts) {
    if (wanted.has(alert.notifId)) continue;
    want(doseNotification(data, alert.run, alert.step, { postAt: alert.at }), alert.at);
  }
  for (const alert of plan.physio.alerts) {
    if (alert.day) want(physioNotification(data, alert.day, { postAt: alert.at }), alert.at);
    else if (alert.appt) want(appointmentNotification(alert.appt, alert.at), alert.at);
  }

  for (const existing of await notifee.getTriggerNotifications()) {
    const id = existing.notification.id;
    if (!isOurs(id)) continue;
    const want = wanted.get(id);
    if (want && existing.notification.data?.sig === want.notification.data.sig) {
      wanted.delete(id); // already scheduled as it should be
    } else {
      void log(`cancel alarm ${id}${want ? ' (to change it)' : ''}`);
      await notifee.cancelTriggerNotification(id);
    }
  }

  for (const { notification, at } of wanted.values()) {
    if (at <= Date.now() + 2000) continue; // too late to schedule; shown below as due
    void log(`set alarm ${notification.id} at ${clock(at)} on ${notification.android?.channelId}`);
    await notifee.createTriggerNotification(notification, {
      type: TriggerType.TIMESTAMP,
      timestamp: at,
      alarmManager: { type },
    });
  }

  // 2. Notifications in the notification drawer
  const displayed = await notifee.getDisplayedNotifications();
  const shown = new Map<string, Record<string, unknown> | undefined>();
  for (const d of displayed) {
    const id = d.notification?.id ?? d.id;
    if (isOurs(id)) shown.set(id, d.notification?.data);
  }
  void log(
    `sync (${why}): due [${plan.due.map(d => `${d.step.notifId} since ${clock(d.lastAlertAt)}`).join(', ')}]` +
      ` · in drawer [${displayed.map(d => (d.notification?.id ? d.notification.id : `no id, ${d.id}`)).join(', ')}]`,
  );

  const physioDue = plan.physio.due?.visible ? plan.physio.due.day : null;
  const keep = new Set([
    ...plan.due.filter(d => d.visible).map(d => d.step.notifId),
    ...plan.countdowns.map(c => c.notifId),
    ...(physioDue ? [physioDue.notifId] : []),
    ...plan.physio.keep,
  ]);
  for (const id of shown.keys()) {
    if (keep.has(id)) continue;
    void log(`remove from drawer ${id}`);
    await notifee.cancelDisplayedNotification(id);
  }

  for (const d of plan.due) {
    if (!d.visible || shown.has(d.step.notifId)) continue;
    // Missing although due: its alarm was missed, or it was just swiped away.
    // Only make noise if it became due a moment ago.
    const fresh = now - d.lastAlertAt < 2 * MINUTE;
    void log(`show ${d.step.notifId} ${fresh ? 'WITH SOUND' : 'quietly'} (due but not in the drawer)`);
    await notifee.displayNotification(doseNotification(data, d.run, d.step, { quiet: !fresh }));
  }

  if (physioDue && !shown.has(physioDue.notifId)) {
    const quiet = now - physioDue.dueAt >= 2 * MINUTE; // only make noise if it became due a moment ago
    void log(`show ${physioDue.notifId} ${quiet ? 'quietly' : 'WITH SOUND'} (due but not in the drawer)`);
    await notifee.displayNotification(physioNotification(data, physioDue, { quiet }));
  }

  for (const c of plan.countdowns) {
    if (c.step.dueAt - now < MINUTE) continue;
    const notification = countdownNotification(data, c.run, c.step, c.after, now);
    if (shown.get(c.notifId)?.sig === notification.data.sig) continue;
    void log(`show countdown ${c.notifId}`);
    await notifee.displayNotification(notification);
  }
};

/** Shows a due medicine (or the physio reminder) again without sound, after it was swiped away. */
export const redisplayQuietly = async (notifId: string) => {
  const data = await getData();
  const plan = planNotifications(data, Date.now());
  const physio = plan.physio.due;
  if (physio?.visible && physio.day.notifId === notifId) {
    void log(`show ${notifId} quietly (after a swipe)`);
    await notifee.displayNotification(physioNotification(data, physio.day, { quiet: true }));
    return;
  }
  const due = plan.due.find(d => d.step.notifId === notifId);
  if (!due?.visible) return;
  void log(`show ${notifId} quietly (after a swipe)`);
  await notifee.displayNotification(doseNotification(data, due.run, due.step, { quiet: true }));
};

/** Number of our alarms currently scheduled with Android. */
export const scheduledCount = async () => (await notifee.getTriggerNotificationIds()).filter(id => isOurs(id)).length;
