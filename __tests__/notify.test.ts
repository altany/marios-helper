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
    ...jest.requireActual('@notifee/react-native/dist/types/Notification'),
    ...jest.requireActual('@notifee/react-native/dist/types/NotificationAndroid'),
    ...jest.requireActual('@notifee/react-native/dist/types/Trigger'),
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

import { EventType } from '@notifee/react-native/dist/types/Notification';
import { runId, stepNotifId } from '../src/engine/runs';
import { atTime } from '../src/lib/time';
import { CH_DOSE, CH_DOSE_QUIET } from '../src/notify/channels';
import { handleEvent } from '../src/notify/events';
import { syncNotifications } from '../src/notify/sync';
import { getData, update } from '../src/store/store';

const DAY = '2026-10-12';
const t = (hhmm: string) => atTime(DAY, hhmm);
const EYES = runId('eyes-am-pm', DAY, '09:00');
const HYLOGEL = stepNotifId(EYES, 0);
const LACRIMMUNE = stepNotifId(EYES, 1);

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
  await getData(); // fresh install: default schedule created at 07:00
});

it('schedules the day ahead', async () => {
  await syncNotifications();
  expect(mockNotifs.triggers.get(HYLOGEL)?.trigger.timestamp).toBe(t('09:00'));
  expect(mockNotifs.triggers.has(LACRIMMUNE)).toBe(false); // only after Hylogel is given
  expect(mockNotifs.triggers.size).toBeGreaterThan(30); // about a week
});

it('repeats an unanswered reminder', async () => {
  at('09:00');
  mockNotifs.fire(HYLOGEL);
  await handleEvent(
    { type: EventType.DELIVERED, detail: { notification: mockNotifs.displayed.get(HYLOGEL)!.notification } },
    false,
  );
  expect(mockNotifs.triggers.get(HYLOGEL)?.trigger.timestamp).toBe(t('09:10'));
  expect(mockNotifs.displayed.has(HYLOGEL)).toBe(true);
});

it('brings it back quietly when swiped away', async () => {
  at('09:02');
  const notification = mockNotifs.displayed.get(HYLOGEL)!.notification;
  mockNotifs.displayed.delete(HYLOGEL);
  await handleEvent({ type: EventType.DISMISSED, detail: { notification } }, false);
  expect(mockNotifs.displayed.get(HYLOGEL)?.notification.android.channelId).toBe(CH_DOSE_QUIET);
});

it('schedules the next medicine from the moment "Το έδωσα" is pressed', async () => {
  at('09:04');
  await press(HYLOGEL, 'give');
  expect(mockNotifs.displayed.has(HYLOGEL)).toBe(false);
  expect(mockNotifs.triggers.has(HYLOGEL)).toBe(false);
  expect(mockNotifs.triggers.get(LACRIMMUNE)?.trigger.timestamp).toBe(t('09:24'));
  expect(mockNotifs.triggers.get(LACRIMMUNE)?.notification.android.channelId).toBe(CH_DOSE);
  expect(mockNotifs.displayed.has(`${LACRIMMUNE}~wait`)).toBe(true); // countdown
});

it('snoozes from the notification', async () => {
  at('09:24');
  mockNotifs.fire(LACRIMMUNE);
  await press(LACRIMMUNE, 'snooze');
  expect(mockNotifs.displayed.has(LACRIMMUNE)).toBe(false);
  expect(mockNotifs.triggers.get(LACRIMMUNE)?.trigger.timestamp).toBe(t('09:34'));
});

it('ignores a button on a reminder that was already answered', async () => {
  at('09:35');
  mockNotifs.fire(LACRIMMUNE);
  const stale = mockNotifs.displayed.get(LACRIMMUNE)!.notification;
  await press(LACRIMMUNE, 'give');
  const given = (await getData()).runs[EYES].marks[1].at;
  await handleEvent(
    { type: EventType.ACTION_PRESS, detail: { notification: stale, pressAction: { id: 'snooze' } } },
    false,
  );
  expect((await getData()).runs[EYES].marks[1].at).toBe(given);
  expect(mockNotifs.triggers.has(LACRIMMUNE)).toBe(false);
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
