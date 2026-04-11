import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { scheduleMedicationReminders, getLastNotifactionResponse } from '../services/notifications';
import * as Notifications from 'expo-notifications';
import { getColors } from '../theme';

export default function InstructionsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);

  const [lastNotificationResponse, setLastNotificationResponse] = useState<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    scheduleMedicationReminders();
  }, []);

  useEffect(() => {
    getLastNotifactionResponse().then(r => { if (r) setLastNotificationResponse(r); });
  }, []);

  const { title, body } = lastNotificationResponse?.notification?.request?.content || {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={s.content}>
      <Text style={[s.pageTitle, { color: c.text }]}>Οδηγίες</Text>

      {(title || body) && (
        <View style={[s.notifCard, { borderColor: c.accent, backgroundColor: c.card }]}>
          <Text style={[s.notifLabel, { color: c.accent }]}>Πιο πρόσφατη ειδοποίηση</Text>
          {title && <Text style={[s.notifTitle, { color: c.text }]}>{title}</Text>}
          {body  && <Text style={[s.notifBody,  { color: c.textSecondary }]}>{body}</Text>}
        </View>
      )}

      <Text style={[s.sectionHeader, { color: c.textSecondary }]}>Ως τέλος Αυγούστου</Text>

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <Text style={[s.medTitle, { color: c.text }]}>Φάρμακο 1: Exocin κολήριο</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>1 σταγόνα × 4 φορές την ημέρα</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>
          Στο <Text style={[s.bold, { color: c.text }]}>αριστερό</Text> μάτι
        </Text>
      </View>

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <Text style={[s.medTitle, { color: c.text }]}>Φάρμακο 2: Hylogel κολήριο</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>1 σταγόνα × 4 φορές την ημέρα</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>
          Και στα <Text style={[s.bold, { color: c.text }]}>δυο μάτια</Text>
        </Text>
      </View>

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <Text style={[s.medTitle, { color: c.text }]}>Φάρμακο 3: Lacrimmune αλοιφή</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>Ποσότητα ίση με ένα κόκκο ρυζιού</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>Ανά 12ωρο (πρωί + βράδυ)</Text>
        <Text style={[s.medDetail, { color: c.textSecondary }]}>Μέσα στο αριστερό μάτι + μασάζ με το βλέφαρο</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '700', marginBottom: 20, marginTop: 12 },
  sectionHeader: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 4 },
  notifCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20, gap: 4 },
  notifLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  notifTitle: { fontSize: 15, fontWeight: '600' },
  notifBody: { fontSize: 14 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 10, gap: 6 },
  medTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  medDetail: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '700' },
});
