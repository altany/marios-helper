import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HANDLED_NOTIFICATION_KEY = 'lastHandledNotificationId';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

const snooze = {
  identifier: 'SNOOZE',
  buttonTitle: 'Αργότερα (10\')',
  options: {
    opensAppToForeground: false,
  },
}

const next = {
  identifier: 'NEXT',
  buttonTitle: 'Lacrimmune σε 20\'',
  options: {
    opensAppToForeground: false,
  },
}

const completed = {
  identifier: 'COMPLETE',
  buttonTitle: 'Τέλος',
  options: {
    opensAppToForeground: false,
  },
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
      await Notifications.setNotificationCategoryAsync('complete-category', [snooze, completed]);
      await Notifications.setNotificationCategoryAsync('next-category', [snooze, next]);
    } catch (e) {
      console.error('Failed to register notification categories:', e);
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError('Project ID not found');
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
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

  const showActionModal = (body: string, hour: number): Promise<string> => {
    return new Promise((resolve) => {
      setNotificationModal({ visible: true, body, hour, resolve });
    });
  };

  const handleModalAction = (action: string) => {
    notificationModal.resolve?.(action);
    setNotificationModal(prev => ({ ...prev, visible: false, resolve: null }));
  };

  const handleNotificationResponse = async (response: Notifications.NotificationResponse, skipGuard = false) => {
    console.log('Action', response);

    const { content: { body, data, categoryIdentifier }, trigger, identifier } = response.notification.request as { content: { body: string, data: any, categoryIdentifier: string }, trigger: any, identifier: string };
    const { medication } = data;

    // Guard: skip if this notification was already handled (prevents double-firing
    // when both getLastNotificationResponseAsync and the response listener trigger
    // for the same notification on app resume).
    // skipGuard is true for recursive calls after the in-app alert resolves,
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

    if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      console.log('should show alert now')
      const alertResponse = await showActionModal(body, hour);
      console.log('User selected:', alertResponse);
      response.actionIdentifier = alertResponse;
      await handleNotificationResponse(response, true);
      return;
    } else if (actionIdentifier === 'SNOOZE') {
      const newTrigger = { seconds: 10 * 60 }; // 10 minutes
      console.log(`Snoozing ${medication} for ${hour}:00`);
      await Notifications.scheduleNotificationAsync({
        content: {
          body,
          data,
          categoryIdentifier,
          ...notificationCommonContent,
        },
        trigger: newTrigger,
      });
    } else if (actionIdentifier === 'NEXT') {
      console.log(`Preparing a notification for the medication after ${medication} for ${hour}:00`);

      let notificationData;

      switch (medication) {
        case 'hylogel':
            notificationData = {
              categoryIdentifier: 'complete-category',
              body: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
              data: {
                text: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
                medication: 'lacrimmune',
                hour
              }
            };
          break;
      }

      console.log(`Next notification for ${JSON.stringify(notificationData)}`);

        await Notifications.scheduleNotificationAsync({
          content: {
            ...notificationCommonContent,
            ...notificationData
          },
          trigger: {
            seconds: 20 * 60, // 20 minutes
          },
        });
    } else if (actionIdentifier === 'COMPLETE') {
      // Handle the task completion
      console.log(`${medication} was given`);
    }

    Notifications.dismissNotificationAsync(identifier);
  };

  const handleBackgroundNotificationResponse = async () => {
    const response = await getLastNotifactionResponse();
    console.log('In BACKGROUND handler')
    if (response) {
      handleNotificationResponse(response)
    }
  };

  useEffect(() => {
    handleBackgroundNotificationResponse();
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('In FOREGROUND handler')
      handleNotificationResponse(response)
    }
    );

    return () => {
      responseListener.remove();
    };
  }, []);

  return { notificationModal, handleModalAction };

};
