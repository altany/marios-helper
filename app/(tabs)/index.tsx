import { useEffect, useState } from 'react';
import {  StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { scheduleMedicationReminders, getLastNotifactionResponse } from '../services/notifications';
import * as Notifications from 'expo-notifications';

export default function App() {


  const [lastNotificationResponse, setLastNotificationResponse] = useState<Notifications.NotificationResponse| null>(null)
  useEffect(() => {
    scheduleMedicationReminders();
  }, []);
  
  useEffect(() => {
    const getLastResponse = async () => {
      await getLastNotifactionResponse().then((response) => {
        if (response) {
          setLastNotificationResponse(response);
        }
      });
    }
    getLastResponse();
    
  }, []);

  console.log('lastNotificationResponse', lastNotificationResponse) 
  const {title, body} = lastNotificationResponse?.notification?.request?.content || {};

  return (
    <ThemedView style={styles.wrapper}>
      {(title || body) && (
        <ThemedView style={styles.notification}>
          <ThemedText>Πιο πρόσφατη ειδοποιήση:</ThemedText>
          {title && <ThemedText>{title}</ThemedText>}
          {body && <ThemedText>{body}</ThemedText>}
        </ThemedView>
      )}
      <ThemedText>Ως τέλος Αυγούστου:</ThemedText>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Φάρμακο 1: Exocin κολήριο</ThemedText>
        <ThemedText>1 σταγόνα x  4 φορές την ημέρα</ThemedText>
        <ThemedText>Στο <ThemedText type="defaultSemiBold">αριστερό</ThemedText> μάτι</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Φάρμακο 2: Hylogel κολήριο</ThemedText>
        <ThemedText>1 σταγόνα x 4 φορές την ημέρα</ThemedText>
        <ThemedText>Και στα <ThemedText type="defaultSemiBold">δυο μάτια</ThemedText></ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Φάρμακο 3: Lacrimmune αλοιφή</ThemedText>
        <ThemedText>Ποσότητα ίση με ένα κόκκο ρυζιού</ThemedText>
        <ThemedText>Ανά 12ωρο (πρωί + βράδυ)</ThemedText>
        <ThemedText>Μέσα στο αριστερό μάτι + μασάζ με το βλέφαρο</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 40,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20
  },
  notification: {
    backgroundColor: '#317181',
    marginTop:10,
    marginBottom:10,
    padding:10,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
    marginTop: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});