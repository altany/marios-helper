import { PHYSIO_SNOOZE_MIN, physioDay } from '../engine/physio';
import { buildRun, dayDone, nextUpcoming } from '../engine/runs';
import { dateKey } from '../lib/time';
import { getData, update } from '../store/store';
import { giveStep, physioDone, snoozePhysioFor, snoozeStepFor } from './commands';
import { ACTION_GIVE, ACTION_PHYSIO_DONE, ACTION_PHYSIO_LATER, ACTION_SNOOZE, bravoNotification } from './content';
import notifee, { Event, EventType } from './driver';
import { log } from './log';
import { redisplayQuietly, syncNotifications } from './sync';

// Handles taps on notifications. Runs both when the app is open (foreground)
// and when Android wakes the app in the background (app closed), so the
// "Το έδωσα" button on the phone or the watch always schedules the next medicine
// (and "Έγινε" on the physio reminder marks the day done).

export const TEST_NOTIFICATION_ID = 'test-notification';

type PromptTarget = { runId: string; index: number };
const promptListeners = new Set<(t: PromptTarget) => void>();
// A request made before the screen is ready (e.g. app opened from a notification
// while the font loads) waits here for the first listener.
let pendingPrompt: PromptTarget | null = null;

/** The app listens here to open the dose screen when a notification is tapped or fires. */
export const onPrompt = (listener: (t: PromptTarget) => void) => {
  promptListeners.add(listener);
  if (pendingPrompt) {
    listener(pendingPrompt);
    pendingPrompt = null;
  }
  return () => {
    promptListeners.delete(listener);
  };
};
export const requestPrompt = (t: PromptTarget) => {
  if (promptListeners.size === 0) pendingPrompt = t;
  else promptListeners.forEach(l => l(t));
};

const targetOf = (event: Event): PromptTarget | null => {
  const data = event.detail.notification?.data;
  const runId = typeof data?.runId === 'string' ? data.runId : null;
  const index = Number(data?.index);
  return runId && Number.isInteger(index) ? { runId, index } : null;
};

/** Is this step still waiting for an answer? Old buttons on stale notifications are ignored. */
const stillOpen = async ({ runId, index }: PromptTarget) => {
  const data = await getData();
  const step = buildRun(data, runId, Date.now())?.steps[index];
  return !!step && (step.status === 'due' || step.status === 'upcoming' || step.status === 'missed');
};

/** After the last dose of the day, a "Μπράβο" with Mario's photo. */
const celebrateIfDayDone = async (runId: string) => {
  const now = Date.now();
  const data = await getData();
  const run = buildRun(data, runId, now);
  if (!run || run.date !== dateKey(now) || !dayDone(data, run.date, now)) return;
  void log('show well done');
  await notifee.displayNotification(bravoNotification(data, nextUpcoming(data, now), now));
};

/** The daily physio reminder and the reminder before a visit. Tapping them just opens the app. */
const handlePhysioEvent = async ({ type, detail }: Event) => {
  const notifId = detail.notification?.id;
  const date = detail.notification?.data?.date;
  if (!notifId || typeof date !== 'string') return; // a visit reminder: nothing to answer

  switch (type) {
    case EventType.ACTION_PRESS: {
      const day = physioDay(await getData(), date, Date.now());
      const action = detail.pressAction?.id;
      if (action === ACTION_PHYSIO_DONE && day.status !== 'done') await physioDone(date);
      else if (action === ACTION_PHYSIO_LATER && day.status === 'due') await snoozePhysioFor(date, PHYSIO_SNOOZE_MIN);
      else await syncNotifications('old physio button'); // a stale button: clear it
      return;
    }
    case EventType.DISMISSED: {
      const data = await getData();
      if (data.settings.sticky) await redisplayQuietly(notifId);
      else
        await update(d => {
          d.dismissed[notifId] = Date.now();
        });
      return;
    }
    case EventType.DELIVERED:
      await syncNotifications('physio reminder shown');
      return;
  }
};

export const handleEvent = async (event: Event, foreground: boolean) => {
  const { type, detail } = event;
  const notifId = detail.notification?.id;
  void log(
    `event ${EventType[type] ?? type} ${notifId ?? '(no id)'} ${foreground ? 'app open' : 'background'}` +
      (detail.pressAction?.id ? ` · button ${detail.pressAction.id}` : '') +
      (detail.notification?.android?.channelId ? ` · ${detail.notification.android.channelId}` : ''),
  );

  if (notifId === TEST_NOTIFICATION_ID) {
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) await notifee.cancelNotification(notifId);
    return;
  }

  const kind = detail.notification?.data?.kind;
  if (kind === 'physio' || kind === 'appt') return handlePhysioEvent(event);

  const target = targetOf(event);
  if (!target) return;

  switch (type) {
    case EventType.ACTION_PRESS: {
      if (!(await stillOpen(target))) {
        await syncNotifications('old button'); // clears the stale notification
        return;
      }
      if (detail.pressAction?.id === ACTION_GIVE) {
        await giveStep(target.runId, target.index);
        await celebrateIfDayDone(target.runId);
      } else if (detail.pressAction?.id === ACTION_SNOOZE) {
        const { settings } = await getData();
        await snoozeStepFor(target.runId, target.index, settings.snoozeMin);
      }
      return;
    }
    case EventType.DISMISSED: {
      if (!notifId || notifId.endsWith('~wait')) return;
      const data = await getData();
      if (data.settings.sticky) {
        // Swiped away without an answer: bring it back, without sound.
        await redisplayQuietly(notifId);
      } else {
        await update(d => {
          d.dismissed[notifId] = Date.now();
        });
      }
      return;
    }
    case EventType.DELIVERED: {
      // A reminder just fired: schedule its next repeat and refresh everything.
      await syncNotifications('reminder shown');
      if (foreground && detail.notification?.data?.kind === 'dose') requestPrompt(target);
      return;
    }
    case EventType.PRESS: {
      // Tapped the notification itself: the app opens on that medicine. (If the
      // app was fully closed, the root layout picks it up with getInitialNotification.)
      requestPrompt(target);
      return;
    }
  }
};
