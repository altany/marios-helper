// The notification layer against a mockNotifs Notifee: checks what gets scheduled,
// shown and removed as the user answers reminders.

type Stored = { notification: any; trigger?: any };

const mockNotifs = {
  triggers: new Map<string, Stored>(),
  displayed: new Map<string, Stored>(),
  /** Android shows a scheduled notification. */
  fire(id: string) {
    const t = mockNotifs.triggers.get(id)!;
    mockNotifs.triggers.delete(id);
    mockNotifs.displayed.set(id, { notification: t.notification });
  },
  reset() {
    mockNotifs.triggers.clear();
    mockNotifs.displayed.clear();
  },
};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/notify/driver', () => {
  const enums = {
    ...jest.requireActual('react-native-notify-kit/dist/types/Notification.js'),
    ...jest.requireActual('react-native-notify-kit/dist/types/NotificationAndroid.js'),
    ...jest.requireActual('react-native-notify-kit/dist/types/Trigger.js'),
  };
  const api = {
    getNotificationSettings: async () => ({ authorizationStatus: 1, android: { alarm: 1 } }),
    createTriggerNotification: async (notification: any, trigger: any) => {
      if (trigger.timestamp <= Date.now()) throw new Error('timestamp must be in the future');
      mockNotifs.triggers.set(notification.id, { notification, trigger });
    },
    getTriggerNotifications: async () => Array.from(mockNotifs.triggers.values()),
    getTriggerNotificationIds: async () => Array.from(mockNotifs.triggers.keys()),
    cancelTriggerNotification: async (id: string) => void mockNotifs.triggers.delete(id),
    displayNotification: async (notification: any) => void mockNotifs.displayed.set(notification.id, { notification }),
    getDisplayedNotifications: async () =>
      Array.from(mockNotifs.displayed.entries()).map(([id, d]) => ({ id, notification: d.notification })),
    cancelDisplayedNotification: async (id: string) => void mockNotifs.displayed.delete(id),
    cancelNotification: async (id: string) => {
      mockNotifs.displayed.delete(id);
      mockNotifs.triggers.delete(id);
    },
  };
  return { __esModule: true, default: api, ...enums };
});

import { EventType } from 'react-native-notify-kit/dist/types/Notification.js';
import { markStep } from '../src/engine/actions';
import { runId, runsForDay, stepNotifId } from '../src/engine/runs';
import { atTime } from '../src/lib/time';
import { CH_DOSE, CH_DOSE_BARK, CH_DOSE_QUIET } from '../src/notify/channels';
import { BRAVO_ID } from '../src/notify/content';
import { handleEvent } from '../src/notify/events';
import { syncNotifications } from '../src/notify/sync';
import { getData, replaceAll, update } from '../src/store/store';
import { sampleData } from './fixtures';

const DAY = '2026-10-12';
const t = (hhmm: string) => atTime(DAY, hhmm);
const EYES = runId('eyes-am-pm', DAY, '09:00');
const BLINKDROPS = stepNotifId(EYES, 0);
const TEARSHIELD = stepNotifId(EYES, 1);

const at = (hhmm: string) => jest.setSystemTime(t(hhmm));
const press = (id: string, action: string) =>
  handleEvent(
    {
      type: EventType.ACTION_PRESS,
      detail: { notification: mockNotifs.displayed.get(id)!.notification, pressAction: { id: action } },
    },
    false,
  );

beforeAll(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  at('07:00');
  await getData(); // fresh install starts empty…
  await replaceAll(sampleData(Date.now())); // …then Mario's schedule is entered at 07:00
});

it('schedules the day ahead', async () => {
  await syncNotifications();
  expect(mockNotifs.triggers.get(BLINKDROPS)?.trigger.timestamp).toBe(t('09:00'));
  const { notification } = mockNotifs.triggers.get(BLINKDROPS)!;
  expect(notification.title).toBe('Ώρα για Blinkdrops, Μάριο!');
  // Notifee reads the text as HTML, so new lines must be <br>.
  expect(notification.android.style.text).toBe('<b>1 σταγόνα σε κάθε μάτι</b><br><i>Μετά: Tearshield σε 20 λεπτά</i>');
  expect(mockNotifs.triggers.has(TEARSHIELD)).toBe(false); // only after Blinkdrops is given
  expect(mockNotifs.triggers.size).toBeGreaterThan(30); // about a week
});

it('repeats an unanswered reminder', async () => {
  at('09:00');
  mockNotifs.fire(BLINKDROPS);
  await handleEvent(
    { type: EventType.DELIVERED, detail: { notification: mockNotifs.displayed.get(BLINKDROPS)!.notification } },
    false,
  );
  expect(mockNotifs.triggers.get(BLINKDROPS)?.trigger.timestamp).toBe(t('09:10'));
  expect(mockNotifs.triggers.get(BLINKDROPS)?.notification.title).toBe('Ξέχασες το Blinkdrops;');
  expect(mockNotifs.displayed.has(BLINKDROPS)).toBe(true);
});

it('brings it back quietly when swiped away', async () => {
  at('09:02');
  const notification = mockNotifs.displayed.get(BLINKDROPS)!.notification;
  mockNotifs.displayed.delete(BLINKDROPS);
  await handleEvent({ type: EventType.DISMISSED, detail: { notification } }, false);
  expect(mockNotifs.displayed.get(BLINKDROPS)?.notification.android.channelId).toBe(CH_DOSE_QUIET);
});

it('schedules the next medicine from the moment "Το έδωσα" is pressed', async () => {
  at('09:04');
  await press(BLINKDROPS, 'give');
  expect(mockNotifs.displayed.has(BLINKDROPS)).toBe(false);
  expect(mockNotifs.triggers.has(BLINKDROPS)).toBe(false);
  expect(mockNotifs.triggers.get(TEARSHIELD)?.trigger.timestamp).toBe(t('09:24'));
  expect(mockNotifs.triggers.get(TEARSHIELD)?.notification.android.channelId).toBe(CH_DOSE_BARK);
  expect(mockNotifs.displayed.has(`${TEARSHIELD}~wait`)).toBe(true); // countdown
});

it('snoozes from the notification', async () => {
  at('09:24');
  mockNotifs.fire(TEARSHIELD);
  await press(TEARSHIELD, 'snooze');
  expect(mockNotifs.displayed.has(TEARSHIELD)).toBe(false);
  expect(mockNotifs.triggers.get(TEARSHIELD)?.trigger.timestamp).toBe(t('09:34'));
});

it('ignores a button on a reminder that was already answered', async () => {
  at('09:35');
  mockNotifs.fire(TEARSHIELD);
  const stale = mockNotifs.displayed.get(TEARSHIELD)!.notification;
  await press(TEARSHIELD, 'give');
  const given = (await getData()).runs[EYES].marks[1].at;
  await handleEvent(
    { type: EventType.ACTION_PRESS, detail: { notification: stale, pressAction: { id: 'snooze' } } },
    false,
  );
  expect((await getData()).runs[EYES].marks[1].at).toBe(given);
  expect(mockNotifs.triggers.has(TEARSHIELD)).toBe(false);
});

it('moves one reminder to another time only that day', async () => {
  const evening = runId('eyes-am-pm', DAY, '21:00');
  const tomorrow = runId('eyes-am-pm', '2026-10-13', '21:00');
  await update(d => {
    d.runs[evening] = {
      id: evening,
      routineId: 'eyes-am-pm',
      date: DAY,
      time: '21:00',
      startAt: t('22:15'),
      marks: {},
      snoozed: {},
    };
  });
  await syncNotifications();
  expect(mockNotifs.triggers.get(stepNotifId(evening, 0))?.trigger.timestamp).toBe(t('22:15'));
  expect(mockNotifs.triggers.get(stepNotifId(tomorrow, 0))?.trigger.timestamp).toBe(atTime('2026-10-13', '21:00'));
});

it('says well done after the last dose of the day', async () => {
  at('22:20');
  const open = runsForDay(await getData(), DAY, Date.now())
    .flatMap(run => run.steps.map(step => ({ run, step })))
    .filter(({ step }) => step.status !== 'given' && step.status !== 'skipped');
  const last = open.pop()!;
  await update(d => {
    for (const { run, step } of open) markStep(d, run.id, step.index, 'given', Date.now());
  });
  expect(mockNotifs.displayed.has(BRAVO_ID)).toBe(false);

  const notification = { id: last.step.notifId, data: { runId: last.run.id, index: String(last.step.index) } };
  await handleEvent({ type: EventType.ACTION_PRESS, detail: { notification, pressAction: { id: 'give' } } }, false);
  const bravo = mockNotifs.displayed.get(BRAVO_ID)?.notification;
  expect(bravo?.title).toBe('Μπράβο Μάριο!');
  expect(bravo?.body).toContain('Επόμενο: αύριο στις 09:00');
});

it('uses the usual sound when barking is off', async () => {
  await update(d => {
    d.settings.bark = false;
  });
  await syncNotifications();
  const channels = new Set(Array.from(mockNotifs.triggers.values()).map(n => n.notification.android.channelId));
  expect(channels).toEqual(new Set([CH_DOSE]));
});

it('speaks English when the language is English', async () => {
  await update(d => {
    d.settings.language = 'en';
    d.settings.petName = 'Mario';
  });
  await syncNotifications();
  const tomorrow = runId('eyes-am-pm', '2026-10-13', '09:00');
  const { notification } = mockNotifs.triggers.get(stepNotifId(tomorrow, 0))!;
  expect(notification.title).toBe('Time for Blinkdrops, Mario!');
  expect(notification.android.style.text).toBe('<b>1 σταγόνα σε κάθε μάτι</b><br><i>Next: Tearshield in 20 minutes</i>');
  expect(notification.android.actions.map((a: { title: string }) => a.title)).toEqual(['I gave it', 'Later 10 minutes']);

  // Back to Greek: the scheduled reminders are rewritten.
  await update(d => {
    d.settings.language = 'el';
    d.settings.petName = 'Μάριο';
  });
  await syncNotifications();
  expect(mockNotifs.triggers.get(stepNotifId(tomorrow, 0))!.notification.title).toBe('Ώρα για Blinkdrops, Μάριο!');
});
