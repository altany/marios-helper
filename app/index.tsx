import { useEffect } from 'react';
import { Text, View, Button } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePushNotifications, scheduleMedicationReminders, test} from './services/notifications';
export default function App() {
  const {notification} = usePushNotifications();

  useEffect(() => {
      scheduleMedicationReminders();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-around' }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text>Title: {notification && notification.request.content.title} </Text>
        <Text>Body: {notification && notification.request.content.body}</Text>
        <Text>Data: {notification && JSON.stringify(notification.request.content.data)}</Text>
      </View>
      {/* <Button
        title="Press to Send Notification"
        onPress={async () => {
          await test();
        }}
      /> */}
    </View>
  );
}
