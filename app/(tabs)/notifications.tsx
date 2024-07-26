import { StyleSheet, Button} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {  getScheduledNotifications, test} from '../services/notifications';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications'
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Notification() {
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);
  const fetchScheduledNotifications = async () => {
    const notifications = await getScheduledNotifications()
    setScheduledNotifications(notifications);
  };

  useEffect(()=>{
    fetchScheduledNotifications();
  }, [])

  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
    headerImage={<Ionicons size={310} name="code-slash" style={styles.headerImage} />}>

      <ThemedView style={styles.stepContainer}>
        <ThemedText>Έχεις ζητήσεις τις εξής ειδοποιήσεις:</ThemedText>

        {scheduledNotifications.filter(notification=>{
          return notification.trigger.repeats === false
        }).map((notification, index) => {
          return <ThemedText key={index}>
            <Ionicons size={10} name="medical" 
           />{JSON.stringify(notification.content.body)}</ThemedText>
        })}
      </ThemedView>
      <Button
        title="Refresh"
        onPress={async () => {
          await fetchScheduledNotifications();
        }}
      /> 
      <Button
        title="Press to Test Notifications"
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