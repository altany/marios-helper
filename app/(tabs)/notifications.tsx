import { StyleSheet, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useScheduledNotifications } from '../services/notifications';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Notification() {
  const { 
    scheduledNotifications, 
    getScheduledNotifications, 
    resetNotifications, 
    disableNotifications, 
    test 
  } = useScheduledNotifications();
  
  const dailyNotifications = scheduledNotifications
  .filter(notification=>{return notification.trigger.type==='daily'})
  const pendingNotifications = scheduledNotifications.filter((notification) => {
    return notification.trigger.type === 'timeInterval';
  })
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
          <>
            {dailyNotifications.map((notification, index) => {
              const { data, body } = notification.content;
              return (
                <ThemedText key={index}>
                  <Ionicons size={10} name="medical" />
                  {data.hour > 0 ? `${data.hour}:00` : '(δοκιμή):'} {JSON.stringify(body)}
                </ThemedText>
              );
            })}
          </>
        )}
        </ThemedView>
        <ThemedText>Εκρεμμούν:</ThemedText>
        <ThemedView style={styles.notificationsList}>
          { pendingNotifications.length===0 ? (
          <ThemedText>Δεν έχεις εκρεμμείς ειδοποιήσεις!</ThemedText>
          ): (
            <>
            { pendingNotifications.map((notification, index) => {
              const { data, body } = notification.content;
              return (
                <ThemedText key={index}>
                  <Ionicons size={10} name="medical" />
                  {data.hour > 0 ? `${data.hour}:00` : 'δοκιμή:'} {JSON.stringify(body)}
                </ThemedText>
              );
            })}
            </>)}
            
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