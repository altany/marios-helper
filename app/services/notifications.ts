import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


const schedule = [
  { hour: 9, },
  { hour: 14, },
  { hour: 18, },
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

Notifications.setNotificationCategoryAsync('exocin-reminder', [
  snooze,
  {
    ...next,
    buttonTitle: 'Hylogel σε 20\''
  },
]);

Notifications.setNotificationCategoryAsync('hylogel-reminder', [
  snooze,
  {
    ...next,
    buttonTitle: 'Lacrimmune σε 20\''
  },
]);

Notifications.setNotificationCategoryAsync('last-reminder', [
  snooze,
  completed
]);

export const test = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      ...notificationCommonContent,
      categoryIdentifier: 'exocin-reminder',
      body: `Σταγόνες Exocin - 1 σταγόνα στο αριστερό`,
      data: {
        hour: 0,
        text: 'Σταγόνες Exocin - 1 σταγόνα στο αριστερό',
        medication: 'exocin'
      },
    },
    trigger: {
      seconds: 3,
    },
  })
}

export async function scheduleMedicationReminders() {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const hours = scheduledNotifications.map(notification => notification.trigger.hour);
  const hasAllHours = [9, 14, 18, 21].every(hour => hours.includes(hour));
  console.log('Scheduled notifications already set?', hasAllHours);
  if (!hasAllHours) {
    for (const time of schedule) {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...notificationCommonContent,
          categoryIdentifier: 'exocin-reminder',
          body: `Σταγόνες Exocin - 1 σταγόνα στο αριστερό`,
          data: {
            text: 'Σταγόνες Exocin - 1 σταγόνα στο αριστερό',
            medication: 'exocin',
            hour: time.hour
          },
        },
        trigger: {
          hour: time.hour,
          minute: 0,
          repeats: true,
        },
      })
    }
  }

}

// Handle the notification response
export const handleNotificationReponse = async (response: Notifications.NotificationResponse) => {
  try {
    console.log('Action', response)
    const { content: { body, data, categoryIdentifier }, trigger } = response.notification.request as { content: { body: string, data: any, categoryIdentifier: string }, trigger: any }
    const { medication } = data

    // Extract the hour if the trigger is time - based
    const hour = (trigger && 'dateComponents' in trigger && trigger.dateComponents?.hour !== undefined) ?
      trigger.dateComponents.hour : data.hour

    const actionIdentifier = response.actionIdentifier;

    if (actionIdentifier === 'SNOOZE') {
      const newTrigger = { seconds: 10 * 60 * 1000 } // 10 minutes
      console.log(`Snoozing ${medication} for ${hour}:00`)
      await Notifications.scheduleNotificationAsync({
        content: {
          body,
          data,
          categoryIdentifier,
          ...notificationCommonContent,
        },
        trigger: newTrigger,
      })
    } else if (actionIdentifier === 'NEXT') {
      console.log(`Preping a notification for the medication after ${medication} for ${hour}:00`)

      const hylogelData = {
        categoryIdentifier: hour === 9 || hour === 21 ? 'hylogel-reminder' : 'last-reminder',
        body: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
        data: {
          text: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
          medication: 'hylogel'
        }
      }

      const lacrimmuneData = {
        categoryIdentifier: 'last-reminder',
        body: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
        data: {
          text: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
          medication: 'lacrimmune'
        }
      }
      let notificationData;

      switch (medication) {
        case 'exocin':
          notificationData = hylogelData;
          break;
        case 'hylogel':
          notificationData = lacrimmuneData;
          break;
      }

      console.log(`Next notification for ${JSON.stringify(notificationData)}`)

      await Notifications.scheduleNotificationAsync({
        content: {
          ...notificationCommonContent,
          ...notificationData
        },
        trigger: {
          seconds: 20 * 60, // 20 minutes
        },
      })

    }
    else if (actionIdentifier === 'COMPLETE') {
      // Handle the task completion
      console.log(`${medication} was given`);
    }
    Notifications.dismissNotificationAsync(response.notification.request.identifier);
  } catch (error) {
    console.log(error)
  }
};

export const getScheduledNotifications = async () => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  //console.log(`${scheduledNotifications.length} scheduled notifications`, scheduledNotifications)
  return scheduledNotifications;
}

export const resetNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  scheduleMedicationReminders();
  console.log('Notifications reset');
}

export const disableNotifications = async () => {
  Notifications.cancelAllScheduledNotificationsAsync();
  console.log('Notifications disabled');
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

export const usePushNotifications = () => {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const [lastNotificationResponse, setLastNotificationResponse] = useState<Notifications.NotificationResponse | undefined>(
    undefined
  );
  //const lastNotif = Notifications.useLastNotificationResponse()
  //console.log('Last notif', lastNotif)

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (!!response) {
          setLastNotificationResponse(response)
          handleNotificationReponse(response)
        }
      });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationReponse
    );

    return () => {
      notificationListener.current &&
        Notifications.removeNotificationSubscription(notificationListener.current);
      responseListener.current &&
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return { lastNotificationResponse }
}