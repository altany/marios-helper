import { StyleSheet, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useScheduledNotifications } from '../services/notifications';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Ionicons from '@expo/vector-icons/Ionicons';

const formatTime = (hour: number, minute: number = 0) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const formatFireTime = (secondsFromNow: number) => {
  const fireDate = new Date(Date.now() + secondsFromNow * 1000);
  return formatTime(fireDate.getHours(), fireDate.getMinutes());
};

export default function Notification() {
  const {
    scheduledNotifications,
    getScheduledNotifications,
    resetNotifications,
    disableNotifications,
    test
  } = useScheduledNotifications();

  const dailyNotifications = scheduledNotifications
    .filter(n => n.trigger.type === 'daily')
    .sort((a, b) => ((a.trigger as any).hour ?? 0) - ((b.trigger as any).hour ?? 0));

  const pendingNotifications = scheduledNotifications
    .filter(n => n.trigger.type === 'timeInterval');

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={<Ionicons size={310} name="code-slash" style={styles.headerImage} />}
    >
      <ThemedView>
        <ThemedText>Καθημερινές ειδοποιήσεις:</ThemedText>
        <ThemedView style={styles.notificationsList}>
          {dailyNotifications.length === 0 ? (
            <ThemedText>Οι καθημερινές ειδοποιήσεις δεν έχουν ενεργοποιηθεί!</ThemedText>
          ) : (
            dailyNotifications.map((notification, index) => {
              const { body } = notification.content;
              const trigger = notification.trigger as any;
              const time = formatTime(trigger.hour ?? 0, trigger.minute ?? 0);
              return (
                <ThemedText key={index}>
                  <Ionicons size={10} name="medical" /> {time} — {body}
                </ThemedText>
              );
            })
          )}
        </ThemedView>

        <ThemedText>Εκκρεμούν:</ThemedText>
        <ThemedView style={styles.notificationsList}>
          {pendingNotifications.length === 0 ? (
            <ThemedText>Δεν έχεις εκκρεμείς ειδοποιήσεις!</ThemedText>
          ) : (
            pendingNotifications.map((notification, index) => {
              const { body } = notification.content;
              const trigger = notification.trigger as any;
              const time = formatFireTime(trigger.seconds ?? 0);
              return (
                <ThemedText key={index}>
                  <Ionicons size={10} name="medical" /> {time} — {body}
                </ThemedText>
              );
            })
          )}
        </ThemedView>
      </ThemedView>
      <Button title="Ανανέωση" onPress={getScheduledNotifications} />
      <Button title="Επαναφορά" onPress={resetNotifications} />
      <Button title="Απενεργοποίηση όλων" onPress={disableNotifications} />
      <Button title="Δοκιμή" onPress={test} />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  notificationsList: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#317181',
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
});
