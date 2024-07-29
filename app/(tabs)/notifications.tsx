import { StyleSheet, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getScheduledNotifications, resetNotifications, disableNotifications, test } from '../services/notifications';
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
      <ThemedView>
        <ThemedText>Έχεις ζητήσεις τις εξής ειδοποιήσεις:</ThemedText>
        <ThemedText>Καθημερινά:</ThemedText>
        <ThemedView style={styles.notificationsList}>
        {scheduledNotifications
          .filter(notification=>{return notification.trigger.type==='daily'})
          .map((notification, index) => {
          const { data, body } = notification.content;
          return (
            <ThemedText key={index}>
              <Ionicons size={10} name="medical" />
              {data.hour>0?`${data.hour}:00`:'test:'} {JSON.stringify(body)}
            </ThemedText>
          );
        })}
        </ThemedView>

        <ThemedText>Εκρεμμούν:</ThemedText>
        <ThemedView style={styles.notificationsList}>
        {scheduledNotifications
          .filter(notification=>{return notification.trigger.type==='timeInterval'})
          .map((notification, index) => {
          const { data, body } = notification.content;
          return (
            <ThemedText key={index}>
              <Ionicons size={10} name="medical" />
              {data.hour>0?`${data.hour}:00`:'test:'} {JSON.stringify(body)}
            </ThemedText>
          );
        })}
        </ThemedView>
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
        title="Disable notifications"
        onPress={async () => {
          await disableNotifications();
        }}
      />
      <Button
        title="Trigger Notification round"
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
  notificationsList: {
    backgroundColor: '#317181',
    marginTop:10,
    marginBottom:10,
    padding:10,
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