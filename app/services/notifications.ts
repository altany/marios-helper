import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMedicationSettings, DEFAULT_SETTINGS, ChainStep } from './medicationSettings';

// Tracks the last notification identifier processed, to prevent double-handling
// when both getLastNotificationResponseAsync and the response listener fire.
const HANDLED_NOTIFICATION_KEY = 'lastHandledNotificationId';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Suppress the system banner when the app is in the foreground — the
    // in-app modal is shown instead via addNotificationReceivedListener,
    // which cannot be swiped away. Show the banner only when backgrounded.
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const notificationCommonContent = {
  title: 'Υπενθύμιση - Φάρμακο Μάριο',
  // Must be boolean true, NOT the string 'default'.
  // With string 'default', SoundResolver resolves it to a non-null URI, which sets
  // shouldPlayDefaultSound=false. When shouldVibrate is also false, ExpoNotificationBuilder
  // calls builder.setSilent(true) — which silences the notification regardless of
  // the channel's sound settings. With boolean true, shouldPlayDefaultSound=true and
  // setSilent is never called, so the channel's sound plays correctly in the background.
  sound: true,
  interruptionLevel: 'timeSensitive' as 'timeSensitive',
  sticky: true,
};

// channelId belongs on the trigger (Android), not the content.
// NOTE: If you ever change CHANNEL_ID, bump the version so Android creates a
// truly fresh channel (Android restores deleted-channel settings when the same
// ID is reused, making delete+recreate with the same ID ineffective).
const CHANNEL_ID = 'medication-alerts-v2';
const androidTriggerBase = { channelId: CHANNEL_ID };

const snooze_pick = {
  identifier: 'SNOOZE_PICK',
  buttonTitle: 'Αργότερα',
  options: { opensAppToForeground: true },
};

const next = {
  identifier: 'NEXT',
  buttonTitle: 'Το έδωσα',
  options: { opensAppToForeground: false },
};

const completed = {
  identifier: 'COMPLETE',
  buttonTitle: 'Τέλος',
  options: { opensAppToForeground: false },
};

export const scheduleMedicationReminders = async () => {
  const settings = await getMedicationSettings();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const med of settings) {
    if (!med.enabled) continue;
    for (const hour of med.times) {
      const alreadyScheduled = scheduled.some(
        n => n.content.data?.medication === med.id && (n.trigger as any)?.hour === hour,
      );
      if (alreadyScheduled) continue;

      const hasChain = (med.chainAtHours?.includes(hour) ?? false) && (med.chain?.length ?? 0) > 0;
      const remainingChain: ChainStep[] = hasChain ? (med.chain ?? []) : [];
      const categoryIdentifier = hasChain ? 'next-category' : 'complete-category';
      console.log(`Scheduling ${med.id} at ${hour}:00, hasChain: ${hasChain}`);
      await Notifications.scheduleNotificationAsync({
        content: {
          ...notificationCommonContent,
          body: med.body,
          categoryIdentifier,
          data: { medication: med.id, hour, hasChain, remainingChain },
        },
        trigger: { ...androidTriggerBase, hour, minute: 0, repeats: true },
      });
    }
  }
};

export const resetAndRescheduleNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await scheduleMedicationReminders();
};

export const useScheduledNotifications = () => {
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

  useEffect(() => {
    getScheduledNotifications();
  }, []);

  const getScheduledNotifications = async () => {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications);
  };

  const resetNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await scheduleMedicationReminders();
    console.log('Notifications reset');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(notifications);
    setScheduledNotifications(notifications);
  };

  const disableNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Notifications disabled');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications);
  };

  const test = async () => {
    const settings = await getMedicationSettings();
    const med = settings.find(m => m.enabled) ?? DEFAULT_SETTINGS[0];
    const testHour = med.times[0] ?? 9;
    const hasChain = (med.chainAtHours?.includes(testHour) ?? false) && (med.chain?.length ?? 0) > 0;
    const remainingChain: ChainStep[] = hasChain ? (med.chain ?? []) : [];
    await Notifications.scheduleNotificationAsync({
      content: {
        ...notificationCommonContent,
        body: med.body,
        categoryIdentifier: hasChain ? 'next-category' : 'complete-category',
        data: { medication: med.id, hour: testHour, hasChain, remainingChain },
      },
      trigger: { ...androidTriggerBase, seconds: 3 },
    });
    console.log('Test notification triggered');
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(notifications);
  };

  return {
    scheduledNotifications,
    getScheduledNotifications,
    resetNotifications,
    disableNotifications,
    test,
  };
};

export const getLastNotifactionResponse = async () => {
  return await Notifications.getLastNotificationResponseAsync();
};

const handleRegistrationError = (errorMessage: string) => {
  alert(errorMessage);
  throw new Error(errorMessage);
};

const setupNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Ειδοποιήσεις φαρμάκου Μάριο',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
};

export const registerForPushNotificationsAsync = async () => {
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

    await setupNotificationChannel();

    try {
      await Notifications.setNotificationCategoryAsync('complete-category', [snooze_pick, completed]);
      await Notifications.setNotificationCategoryAsync('next-category', [snooze_pick, next]);
    } catch (e) {
      console.error('Failed to register notification categories:', e);
    }
  } else {
    handleRegistrationError('Must use physical device for push notifications');
  }
};

export type NotificationModal = {
  visible: boolean;
  body: string;
  hour: number;
  hasChain: boolean;
  resolve: ((action: string) => void) | null;
};

export const usePushNotifications = () => {
  const [notificationModal, setNotificationModal] = useState<NotificationModal>({
    visible: false,
    body: '',
    hour: 0,
    hasChain: false,
    resolve: null,
  });

  // Prevents two concurrent showActionModal calls from overlapping.
  // If a modal is already showing when another fires, default to snooze 10 min
  // so nothing is silently dropped.
  const isShowingModal = useRef(false);

  const showActionModal = (body: string, hour: number, hasChain: boolean): Promise<string> => {
    if (isShowingModal.current) {
      return Promise.resolve('SNOOZE_10');
    }
    isShowingModal.current = true;
    return new Promise(resolve => {
      setNotificationModal({
        visible: true,
        body,
        hour,
        hasChain,
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

  // Core action processor. remainingChain carries the yet-to-fire steps of a
  // multi-medication chain so we never need to re-read settings at action time.
  const processAction = async (
    actionIdentifier: string,
    medication: string,
    body: string,
    categoryIdentifier: string,
    hour: number,
    hasChain: boolean,
    remainingChain: ChainStep[],
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
      await Notifications.scheduleNotificationAsync({
        content: {
          body,
          data: { medication, hour, hasChain, remainingChain },
          categoryIdentifier,
          ...notificationCommonContent,
        },
        trigger: { ...androidTriggerBase, seconds },
      });
    } else if (actionIdentifier === 'NEXT') {
      const [nextStep, ...rest] = remainingChain;
      if (nextStep) {
        // A step chains to the next one only if the current hour is in its chainAtHours
        // (or if chainAtHours is not set, meaning it chains at all hours).
        const nextStepChains = rest.length > 0 &&
          (nextStep.chainAtHours == null || nextStep.chainAtHours.includes(hour));
        console.log(`Scheduling ${nextStep.name} after ${medication} for ${hour}:00, chains further: ${nextStepChains}`);
        await Notifications.scheduleNotificationAsync({
          content: {
            ...notificationCommonContent,
            categoryIdentifier: nextStepChains ? 'next-category' : 'complete-category',
            body: nextStep.body,
            data: { medication: nextStep.id, hour, hasChain: nextStepChains, remainingChain: nextStepChains ? rest : [] },
          },
          trigger: { ...androidTriggerBase, seconds: nextStep.delayMinutes * 60 },
        });
      }
    } else if (actionIdentifier === 'COMPLETE') {
      console.log(`${medication} at ${hour}:00 marked complete`);
    }

    if (notificationIdentifier) {
      try {
        await Notifications.dismissNotificationAsync(notificationIdentifier);
      } catch (e) {
        console.warn('Could not dismiss notification:', e);
      }
    }
  };

  const handleNotificationResponse = async (
    response: Notifications.NotificationResponse,
    skipGuard = false,
  ) => {
    console.log('Action', response);

    const {
      content: { body, data, categoryIdentifier },
      trigger,
      identifier,
    } = response.notification.request as {
      content: { body: string; data: any; categoryIdentifier: string };
      trigger: any;
      identifier: string;
    };

    if (!data?.medication) {
      console.log('Notification has no medication data, skipping');
      return;
    }

    const { medication, hasChain = false, remainingChain = [] } = data;

    // Guard: skip if this notification was already handled (prevents double-firing
    // when both getLastNotificationResponseAsync and the response listener trigger
    // for the same notification on app resume).
    if (!skipGuard) {
      const lastHandledId = await AsyncStorage.getItem(HANDLED_NOTIFICATION_KEY);
      if (lastHandledId === identifier) {
        console.log('Notification already handled, skipping:', identifier);
        return;
      }
      await AsyncStorage.setItem(HANDLED_NOTIFICATION_KEY, identifier);
    }

    // Extract the hour — daily triggers store it in dateComponents, others in data.
    const hour =
      trigger && 'dateComponents' in trigger && trigger.dateComponents?.hour !== undefined
        ? trigger.dateComponents.hour
        : data.hour;

    const actionIdentifier = response.actionIdentifier;

    if (
      actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
      actionIdentifier === 'SNOOZE_PICK'
    ) {
      // DEFAULT_ACTION_IDENTIFIER = user tapped the notification body
      // SNOOZE_PICK = user tapped "Αργότερα" in the shade (opens app for wheel picker)
      console.log('showing modal for action:', actionIdentifier);
      const alertResponse = await showActionModal(body, hour, hasChain);
      console.log('User selected:', alertResponse);
      response.actionIdentifier = alertResponse;
      await handleNotificationResponse(response, true);
      return;
    }

    await processAction(actionIdentifier, medication, body, categoryIdentifier, hour, hasChain, remainingChain as ChainStep[], identifier);
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
      await handleBackgroundNotificationResponse();
    };
    init();

    // When a notification arrives while the app is foregrounded, skip the
    // system banner (suppressed above) and show the non-dismissable modal directly.
    // Also schedule a backup notification in the drawer after 2s so that if the
    // user closes the app without acting, the reminder is still visible.
    const receivedListener = Notifications.addNotificationReceivedListener(async notification => {
      console.log('Notification received in foreground');
      const { body, data, categoryIdentifier } = notification.request.content as {
        body: string;
        data: any;
        categoryIdentifier: string;
      };
      // Skip backup notifications (posted by us below) to avoid modal loops.
      if (!data?.medication || data?.isBackup) {
        console.log('Foreground notification skipped (no medication data or backup)');
        return;
      }
      const { medication, hour, hasChain = false, remainingChain = [] } = data;

      // Schedule backup into the drawer. shouldShowAlert:false means it won't
      // appear as a banner while the app is open, but it will be in the drawer
      // if the user closes the app before acting on the modal.
      const backupId = await Notifications.scheduleNotificationAsync({
        content: {
          ...notificationCommonContent,
          body,
          categoryIdentifier,
          data: { medication, hour, hasChain, remainingChain, isBackup: true },
        },
        trigger: { ...androidTriggerBase, seconds: 2 },
      });

      const action = await showActionModal(body, hour, hasChain);

      // User acted — cancel the backup if not yet fired, dismiss it if already in drawer.
      try { await Notifications.cancelScheduledNotificationAsync(backupId); } catch (_) {}
      try { await Notifications.dismissNotificationAsync(backupId); } catch (_) {}

      await processAction(
        action,
        medication,
        body,
        categoryIdentifier,
        hour,
        hasChain,
        remainingChain as ChainStep[],
        notification.request.identifier,
      );
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('In response handler');
      handleNotificationResponse(response);
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  return { notificationModal, handleModalAction };
};
