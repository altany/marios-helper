import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tracks the last notification identifier processed, to prevent double-handling
// when both getLastNotificationResponseAsync and the response listener fire.
const HANDLED_NOTIFICATION_KEY = 'lastHandledNotificationId';

// Per-hour, per-day keys so we know if a scheduled dose was acted upon today.
const getTodayString = () => new Date().toISOString().split('T')[0];
const getHandledKey = (hour: number) => `notif_handled_${hour}_${getTodayString()}`;
const getSnoozedUntilKey = (hour: number) => `notif_snoozed_until_${hour}`;

const markHandled = (hour: number) =>
  AsyncStorage.setItem(getHandledKey(hour), 'true');

const wasHandledToday = async (hour: number): Promise<boolean> => {
  const val = await AsyncStorage.getItem(getHandledKey(hour));
  return val === 'true';
};

const setSnoozedUntil = (hour: number, until: number) =>
  AsyncStorage.setItem(getSnoozedUntilKey(hour), String(until));

const getSnoozedUntil = async (hour: number): Promise<number> => {
  const val = await AsyncStorage.getItem(getSnoozedUntilKey(hour));
  return val ? parseInt(val) : 0;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Suppress the system banner when the app is in the foreground — the
    // in-app modal is shown instead via addNotificationReceivedListener,
    // which cannot be swiped away. Show the banner only when backgrounded.
    shouldShowAlert: AppState.currentState !== 'active',
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const schedule = [
  { hour: 9, },
  { hour: 15, },
  { hour: 21, },
];

const notificationCommonContent = {
  title: 'Υπενθύμιση - Φάρμακο Μάριο',
  sound: 'default',
  interruptionLevel: 'timeSensitive' as 'timeSensitive',
  sticky: true
}

const snooze_pick = {
  identifier: 'SNOOZE_PICK',
  buttonTitle: 'Αργότερα',
  // Must open the app so the user can choose duration from the wheel picker
  options: { opensAppToForeground: true },
}

const next = {
  identifier: 'NEXT',
  buttonTitle: 'Το έδωσα',
  options: { opensAppToForeground: false },
}

const completed = {
  identifier: 'COMPLETE',
  buttonTitle: 'Τέλος',
  options: { opensAppToForeground: false },
}

const initialNotificationContent = {
  ...notificationCommonContent,
  body: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
  data: {
    text: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
    medication: 'hylogel'
  }
}

export const scheduleMedicationReminders = async () => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const hours = scheduledNotifications.map(notification => notification.trigger.hour);
  const hasAllHours = [9, 15, 21].every(hour => hours.includes(hour));
  console.log('Scheduled notifications already set?', hasAllHours);
  if (!hasAllHours) {
    for (const time of schedule) {
      const notificationsSchedule = {
        content: {
          ...initialNotificationContent,
          categoryIdentifier: time.hour === 15 ? 'complete-category' : 'next-category',
          data: {
            ...initialNotificationContent.data,
            hour: time.hour
          }
        },
        trigger: {
          hour: time.hour,
          minute: 0,
          repeats: true,
        },
      }
      await Notifications.scheduleNotificationAsync(notificationsSchedule)
    }
  }
}

export const useScheduledNotifications = () => {

  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

  useEffect(() => {
    getScheduledNotifications();
  }, []);

  const getScheduledNotifications = async () => {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications)
  }

  const resetNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await scheduleMedicationReminders();
    console.log('Notifications reset');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(notifications)
    setScheduledNotifications(notifications)
  }

  const disableNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Notifications disabled');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications)
  }

  const test = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        ...initialNotificationContent,
        categoryIdentifier: 'next-category',
        data: {
          ...initialNotificationContent.data,
          hour: 0
        }
      },
      trigger: {
        seconds: 3,
      },
    })
    console.log('Test notification triggered');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications)
  }

  return {
    scheduledNotifications,
    getScheduledNotifications,
    resetNotifications,
    disableNotifications,
    test,
    schedule
  }
}

export const getLastNotifactionResponse = async () => {
  return await Notifications.getLastNotificationResponseAsync()
}

const handleRegistrationError = (errorMessage: string) => {
  alert(errorMessage);
  throw new Error(errorMessage);
}

export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      handleRegistrationError('Permission not granted to get push token for push notification!');
      return;
    }

    try {
      await Notifications.setNotificationCategoryAsync('complete-category', [snooze_pick, completed]);
      await Notifications.setNotificationCategoryAsync('next-category', [snooze_pick, next]);
    } catch (e) {
      console.error('Failed to register notification categories:', e);
    }
  } else {
    handleRegistrationError('Must use physical device for push notifications');
  }
}

export type NotificationModal = {
  visible: boolean;
  body: string;
  hour: number;
  resolve: ((action: string) => void) | null;
};

export const usePushNotifications = () => {

  const [notificationModal, setNotificationModal] = useState<NotificationModal>({
    visible: false,
    body: '',
    hour: 0,
    resolve: null,
  });

  // Prevents two concurrent showActionModal calls from overlapping.
  // If a modal is already showing when another fires, default to SNOOZE
  // so nothing is silently dropped.
  const isShowingModal = useRef(false);

  const showActionModal = (body: string, hour: number): Promise<string> => {
    if (isShowingModal.current) {
      return Promise.resolve('SNOOZE');
    }
    isShowingModal.current = true;
    return new Promise((resolve) => {
      setNotificationModal({
        visible: true,
        body,
        hour,
        resolve: (action: string) => {
          isShowingModal.current = false;
          resolve(action);
        },
      });
    });
  };

  const handleModalAction = (action: string) => {
    notificationModal.resolve?.(action);
    setNotificationModal(prev => ({ ...prev, visible: false, resolve: null }));
  };

  // Core action processor — shared by the notification response handler
  // and the missed-notification check on app resume.
  const processAction = async (
    actionIdentifier: string,
    medication: string,
    body: string,
    categoryIdentifier: string,
    hour: number,
    notificationIdentifier?: string,
  ) => {
    if (actionIdentifier === 'SNOOZE' || actionIdentifier.startsWith('SNOOZE_')) {
      // Plain 'SNOOZE' comes from the OS notification button (fixed 10min).
      // 'SNOOZE_N' comes from the in-app modal where N is minutes chosen by user.
      const minutes = actionIdentifier === 'SNOOZE'
        ? 10
        : parseInt(actionIdentifier.split('_')[1]);
      const seconds = minutes * 60;
      console.log(`Snoozing ${medication} for ${hour}:00 by ${minutes} minutes`);
      await setSnoozedUntil(hour, Date.now() + seconds * 1000);
      await Notifications.scheduleNotificationAsync({
        content: {
          body,
          data: { medication, hour },
          categoryIdentifier,
          ...notificationCommonContent,
        },
        trigger: { seconds },
      });
    } else if (actionIdentifier === 'NEXT') {
      console.log(`Preparing Lacrimmune notification after ${medication} for ${hour}:00`);
      if (medication === 'hylogel') {
        await Notifications.scheduleNotificationAsync({
          content: {
            ...notificationCommonContent,
            categoryIdentifier: 'complete-category',
            body: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
            data: {
              text: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
              medication: 'lacrimmune',
              hour,
            },
          },
          trigger: { seconds: 20 * 60 },
        });
      }
      await markHandled(hour);
    } else if (actionIdentifier === 'COMPLETE') {
      console.log(`${medication} was given`);
      await markHandled(hour);
    }

    if (notificationIdentifier) {
      Notifications.dismissNotificationAsync(notificationIdentifier);
    }
  };

  const handleNotificationResponse = async (response: Notifications.NotificationResponse, skipGuard = false) => {
    console.log('Action', response);

    const { content: { body, data, categoryIdentifier }, trigger, identifier } = response.notification.request as { content: { body: string, data: any, categoryIdentifier: string }, trigger: any, identifier: string };

    if (!data?.medication) {
      console.log('Notification has no medication data, skipping');
      Notifications.dismissNotificationAsync(identifier);
      return;
    }

    const { medication } = data;

    // Guard: skip if this notification was already handled (prevents double-firing
    // when both getLastNotificationResponseAsync and the response listener trigger
    // for the same notification on app resume).
    // skipGuard is true for recursive calls after the in-app modal resolves,
    // where the identifier is the same but a real action needs to be processed.
    if (!skipGuard) {
      const lastHandledId = await AsyncStorage.getItem(HANDLED_NOTIFICATION_KEY);
      if (lastHandledId === identifier) {
        console.log('Notification already handled, skipping:', identifier);
        return;
      }
      await AsyncStorage.setItem(HANDLED_NOTIFICATION_KEY, identifier);
    }

    // Extract the hour if the trigger is time-based
    const hour = (trigger && 'dateComponents' in trigger && trigger.dateComponents?.hour !== undefined) ?
      trigger.dateComponents.hour : data.hour;

    const actionIdentifier = response.actionIdentifier;

    if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || actionIdentifier === 'SNOOZE_PICK') {
      // DEFAULT_ACTION_IDENTIFIER = user tapped the notification body
      // SNOOZE_PICK = user tapped "Αργότερα" in the shade (opens app for wheel picker)
      console.log('showing modal for action:', actionIdentifier);
      const alertResponse = await showActionModal(body, hour);
      console.log('User selected:', alertResponse);
      response.actionIdentifier = alertResponse;
      await handleNotificationResponse(response, true);
      return;
    }

    await processAction(actionIdentifier, medication, body, categoryIdentifier, hour, identifier);
  };

  // On app resume, check whether any scheduled dose was silently dismissed
  // (swiped away from the notification shade without tapping an action).
  // Shows the in-app modal for each missed dose, sequentially.
  const checkMissedNotifications = async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const { hour } of schedule) {
      // Only check doses whose scheduled time has passed today
      const hasPassed = currentHour > hour || (currentHour === hour && currentMinute >= 1);
      if (!hasPassed) continue;

      // Skip if already handled (NEXT or COMPLETE was tapped)
      if (await wasHandledToday(hour)) continue;

      // Skip if still within an active snooze window
      const snoozedUntil = await getSnoozedUntil(hour);
      if (snoozedUntil > Date.now()) continue;

      console.log(`Missed notification detected for ${hour}:00 — showing modal`);
      const categoryIdentifier = hour === 15 ? 'complete-category' : 'next-category';
      const action = await showActionModal(initialNotificationContent.body, hour);
      await processAction(
        action,
        initialNotificationContent.data.medication,
        initialNotificationContent.body,
        categoryIdentifier,
        hour,
      );
    }
  };

  const handleBackgroundNotificationResponse = async () => {
    const response = await getLastNotifactionResponse();
    console.log('In BACKGROUND handler');
    if (response) {
      await handleNotificationResponse(response);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Process any tapped background response first, then check for silently
      // dismissed notifications — sequential to avoid races between the two.
      await handleBackgroundNotificationResponse();
      await checkMissedNotifications();
    };
    init();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkMissedNotifications();
      }
    });

    // When a notification arrives while the app is foregrounded, skip the
    // system banner (suppressed above) and show the non-dismissable modal directly.
    const receivedListener = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Notification received in foreground');
      const { body, data, categoryIdentifier } = notification.request.content as { body: string, data: any, categoryIdentifier: string };
      const { medication, hour } = data;
      const action = await showActionModal(body, hour);
      await processAction(action, medication, body, categoryIdentifier, hour, notification.request.identifier);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('In response handler');
      handleNotificationResponse(response);
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
      appStateSubscription.remove();
    };
  }, []);

  return { notificationModal, handleModalAction };

};
