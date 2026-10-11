import { buildRun } from '../engine/runs';
import { getData, update } from '../store/store';
import { giveStep, snoozeStepFor } from './commands';
import { ACTION_GIVE, ACTION_SNOOZE } from './content';
import notifee, { Event, EventType } from './driver';
import { redisplayQuietly, syncNotifications } from './sync';

// Handles taps on notifications. Runs both when the app is open (foreground)
// and when Android wakes the app in the background (app closed), so the
// "Το έδωσα" button on the phone or the watch always schedules the next medicine.

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

export const handleEvent = async (event: Event, foreground: boolean) => {
  const { type, detail } = event;
  const notifId = detail.notification?.id;

  if (notifId === TEST_NOTIFICATION_ID) {
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) await notifee.cancelNotification(notifId);
    return;
  }

  const target = targetOf(event);
  if (!target) return;

  switch (type) {
    case EventType.ACTION_PRESS: {
      if (!(await stillOpen(target))) {
        await syncNotifications(); // clears the stale notification
        return;
      }
      if (detail.pressAction?.id === ACTION_GIVE) {
        await giveStep(target.runId, target.index);
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
      await syncNotifications();
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
