import { useEffect } from 'react';
import {  StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

import { scheduleMedicationReminders} from '../services/notifications';
export default function App() {

  useEffect(() => {
    scheduleMedicationReminders();
}, []);

  return (
    <ThemedView style={styles.wrapper}>
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