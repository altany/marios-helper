import { StyleSheet, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getScheduledNotifications, resetNotifications, test } from '../services/notifications';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Notification() {
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);
  const fetchScheduledNotifications = async () => {
    const notifications = await getScheduledNotifications();
    setScheduledNotifications(notifications);
  };

  useEffect(() => {
    fetchScheduledNotifications();
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={<Ionicons size={310} name="code-slash" style={styles.headerImage} />}
    >
      <ThemedView style={styles.stepContainer}>
        <ThemedText>Έχεις ζητήσεις τις εξής ειδοποιήσεις:</ThemedText>

        {scheduledNotifications.map((notification, index) => {
          const { data, body } = notification.content;
          return (
            <ThemedText key={index}>
              <Ionicons size={10} name="medical" />
              {data.hour>0?`${data.hour}:00`:'test:'} {JSON.stringify(body)}
            </ThemedText>
          );
        })}
      </ThemedView>
      <Button
        title="Refresh"
        onPress={async () => {
          await fetchScheduledNotifications();
        }}
      />
      <Button
        title="Reset notifications"
        onPress={async () => {
          await resetNotifications();
        }}
      />
      <Button
        title="Press to Trigger Notification round"
        onPress={async () => {
          await test();
        }}
      />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 40,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
});