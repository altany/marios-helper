// Web build (used only to preview the screens in a browser): notifications do nothing.
import real, { AuthorizationStatus, AndroidNotificationSetting } from 'react-native-notify-kit';

export * from 'react-native-notify-kit';

const answers: Record<string, unknown> = {
  getTriggerNotifications: [],
  getTriggerNotificationIds: [],
  getDisplayedNotifications: [],
  getInitialNotification: null,
  isBatteryOptimizationEnabled: false,
  isChannelBlocked: false,
  getPowerManagerInfo: { activity: null },
  getNotificationSettings: {
    authorizationStatus: AuthorizationStatus.AUTHORIZED,
    android: { alarm: AndroidNotificationSetting.ENABLED },
  },
  requestPermission: {
    authorizationStatus: AuthorizationStatus.AUTHORIZED,
    android: { alarm: AndroidNotificationSetting.ENABLED },
  },
};

const stub = new Proxy(
  {},
  {
    get: (_, key: string) => {
      if (key === 'onForegroundEvent') return () => () => undefined;
      if (key === 'onBackgroundEvent') return () => undefined;
      return async () => answers[key];
    },
  },
) as typeof real;

export default stub;
