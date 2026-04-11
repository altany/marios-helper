import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { getMedicationSettings, MedicationSchedule } from '../services/medicationSettings';
import { getColors } from '../theme';

const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function InstructionsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMedicationSettings().then(s => {
      setMeds(s);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={[s.fill, s.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={s.content}>
      <Text style={[s.pageTitle, { color: c.text }]}>Οδηγίες</Text>
      <Text style={[s.subtitle, { color: c.textSecondary }]}>Τρέχον πρόγραμμα φαρμάκων</Text>

      {meds.filter(m => m.enabled).map(med => (
        <View key={med.id} style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          {!!med.groupTitle && (
            <Text style={[s.groupTitle, { color: c.accent }]}>{med.groupTitle}</Text>
          )}

          {/* Root medication */}
          <View style={s.medRow}>
            <Text style={[s.medName, { color: c.text }]}>{med.name}</Text>
            <View style={s.timesRow}>
              {med.times.map(h => (
                <View key={h} style={[s.timePill, { backgroundColor: c.accent + '22' }]}>
                  <Text style={[s.timePillText, { color: c.accent }]}>{formatHour(h)}</Text>
                </View>
              ))}
            </View>
          </View>
          {!!med.body && (
            <Text style={[s.medBody, { color: c.textSecondary }]}>{med.body}</Text>
          )}

          {/* Chain steps */}
          {(med.chain ?? []).map((step, idx) => (
            <View key={step.id}>
              <View style={s.chainConnector}>
                <View style={[s.chainLine, { backgroundColor: c.cardBorder }]} />
                <Text style={[s.chainDelay, { color: c.textMuted }]}>+{step.delayMinutes} λεπτά</Text>
                <View style={[s.chainLine, { backgroundColor: c.cardBorder }]} />
              </View>
              <View style={[s.chainStepCard, { backgroundColor: c.inputBg }]}>
                <Text style={[s.medName, { color: c.text }]}>{step.name}</Text>
                {!!step.body && (
                  <Text style={[s.medBody, { color: c.textSecondary }]}>{step.body}</Text>
                )}
                {(med.chainAtHours ?? []).length > 0 && idx === 0 && (
                  <View style={s.timesRow}>
                    {(med.chainAtHours ?? []).map(h => (
                      <View key={h} style={[s.timePill, { backgroundColor: c.accent + '22' }]}>
                        <Text style={[s.timePillText, { color: c.accent }]}>{formatHour(h)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '700', marginBottom: 4, marginTop: 12 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  card: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  medName: { fontSize: 16, fontWeight: '700', flex: 1 },
  medBody: { fontSize: 14, lineHeight: 20 },
  timesRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  timePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  timePillText: { fontSize: 12, fontWeight: '600' },
  chainConnector: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  chainLine: { flex: 1, height: 1 },
  chainDelay: { fontSize: 12 },
  chainStepCard: { borderRadius: 10, padding: 12, gap: 6 },
});
