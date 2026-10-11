// The notification library. Kept behind this file so it can be swapped in one
// place (e.g. for the maintained fork "react-native-notify-kit", same API).
import notifee from '@notifee/react-native';

export * from '@notifee/react-native';
export default notifee;
