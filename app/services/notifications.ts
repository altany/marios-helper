import * as Notifications from 'expo-notifications';
import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const schedule = [
  { hour: 9, },
  { hour: 14, },
  { hour: 18, },
  { hour: 21, },
];

const notificationCommonContent = {
  title: 'Υπενθύμιση - Φάρμακο Μάριο',
  sound: 'default',
  interruptionLevel: 'timeSensitive' as 'timeSensitive'
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

Notifications.setNotificationCategoryAsync('exocin-reminder-full', [
  snooze,
  {
    ...next,
    buttonTitle: 'Hylogel σε 20\''
  },
]);

Notifications.setNotificationCategoryAsync('exocin-reminder-short', [
  snooze,
  {
    ...next,
    buttonTitle: 'Lacrimmune σε 20\''
  },
]);

Notifications.setNotificationCategoryAsync('hylogel-reminder', [
  snooze,
  {
    ...next,
    buttonTitle: 'Lacrimmune σε 20\''
  },
]);

Notifications.setNotificationCategoryAsync('lacrimmune-reminder', [
  snooze,
  completed,
]);



export const test = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      ...notificationCommonContent,
      categoryIdentifier: 'exocin-reminder-short',
      body: `Σταγόνες Exocin - 1 σταγόνα στο αριστερό`,
      data: {
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
  for (const time of schedule) {
    const { hour } = time
    const categoryIdentifier = hour === 14 || hour === 21 ? 'exocin-reminder-short' : 'exocin-reminder-full'
    await Notifications.scheduleNotificationAsync({
      content: {
        ...notificationCommonContent,
        categoryIdentifier,
        body: `Σταγόνες Exocin - 1 σταγόνα στο αριστερό`,
        data: {
          text: 'Σταγόνες Exocin - 1 σταγόνα στο αριστερό',
          medication: 'exocin'
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


// Handle the notification response
const handleAction = async response => {
  console.log('in handler', response)
  const { content, trigger } = response.notification.request
  const actionIdentifier = response.actionIdentifier;

  if (actionIdentifier === 'SNOOZE') {
    const newTrigger = { seconds: 10 * 60 * 1000 } // 10 minutes
    console.log('snoozing')
    Notifications.scheduleNotificationAsync({
      content,
      trigger: newTrigger,
    });
  } else if (actionIdentifier === 'NEXT') {
    // Handle the task completion
    const { data: { medication } } = content
    const { hour } = trigger
    console.log(`Scheduling the medication after ${medication} for ${hour}:00`);

    const hylogelData = {
      categoryIdentifier: 'hylogel-reminder',
      body: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
      data: {
        text: `Σταγόνες Hylogel - 1 σε κάθε μάτι`,
        medication: 'hylogel'
      }
    }

    const lacrimmuneData = {
      categoryIdentifier: 'lacrimmune-reminder',
      body: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
      data: {
        text: `Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ`,
        medication: 'lacrimmune'
      }
    }
    let notificationData;

    switch (medication) {
      case 'exocin':
        if (hour === 14 || hour === 21) {
          notificationData = lacrimmuneData;
        } else {
          notificationData = hylogelData;
        }
        break;
      case 'hylogel':
        notificationData = lacrimmuneData;
        break;
    }

    Notifications.scheduleNotificationAsync({
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
    console.log('Task marked as completed');
  }

  Notifications.dismissNotificationAsync(response.notification.request.identifier);
};

const handleRegistrationError = (errorMessage: string) => {
  alert(errorMessage);
  throw new Error(errorMessage);
}

const registerForPushNotificationsAsync = async () => {
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
      console.log('in register', pushTokenString);
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError('Must use physical device for push notifications');
  }
}

export function usePushNotifications() {
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync()

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('in response listener', notification)
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleAction);

    return () => {
      notificationListener.current &&
        Notifications.removeNotificationSubscription(notificationListener.current);
      responseListener.current &&
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return { notification };
}