import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, RefreshControl } from 'react-native';
import { useScheduledNotifications } from '../services/notifications';
import { getColors } from '../theme';

const formatTime = (hour: number, minute: number = 0) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const formatFireTime = (secondsFromNow: number) => {
  const d = new Date(Date.now() + secondsFromNow * 1000);
  return formatTime(d.getHours(), d.getMinutes());
};

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);

  const { scheduledNotifications, getScheduledNotifications, resetNotifications, disableNotifications, test } =
    useScheduledNotifications();

  const daily = scheduledNotifications
    .filter(n => n.trigger.type === 'daily')
    .sort((a, b) => ((a.trigger as any).hour ?? 0) - ((b.trigger as any).hour ?? 0));

  const pending = scheduledNotifications.filter(n => n.trigger.type === 'timeInterval');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={getScheduledNotifications} tintColor={c.accent} />}
    >
      <Text style={[s.pageTitle, { color: c.text }]}>Ειδοποιήσεις</Text>

      <Text style={[s.sectionTitle, { color: c.textSecondary }]}>Καθημερινές</Text>

      {daily.length === 0 ? (
        <View style={[s.emptyCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[s.emptyText, { color: c.textMuted }]}>Δεν υπάρχουν ενεργές ειδοποιήσεις</Text>
        </View>
      ) : (
        daily.map((n, i) => {
          const trigger = n.trigger as any;
          return (
            <View key={i} style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <View style={[s.timeBadge, { backgroundColor: c.accent + '22' }]}>
                <Text style={[s.timeText, { color: c.accent }]}>
                  {formatTime(trigger.hour ?? 0, trigger.minute ?? 0)}
                </Text>
              </View>
              <Text style={[s.cardBody, { color: c.text }]} numberOfLines={2}>
                {n.content.body}
              </Text>
            </View>
          );
        })
      )}

      {pending.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: c.textSecondary }]}>Εκκρεμούν</Text>
          {pending.map((n, i) => {
            const trigger = n.trigger as any;
            return (
              <View key={i} style={[s.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                <View style={[s.timeBadge, { backgroundColor: c.warning + '22' }]}>
                  <Text style={[s.timeText, { color: c.warning }]}>
                    ⏱ {formatFireTime(trigger.seconds ?? 0)}
                  </Text>
                </View>
                <Text style={[s.cardBody, { color: c.text }]} numberOfLines={2}>
                  {n.content.body}
                </Text>
              </View>
            );
          })}
        </>
      )}

      <View style={s.actions}>
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.btn, s.btnHalf, { backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1 }]}
            onPress={getScheduledNotifications}
          >
            <Text style={[s.btnText, { color: c.text }]}>Ανανέωση</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnHalf, { backgroundColor: c.accent }]}
            onPress={test}
          >
            <Text style={[s.btnText, { color: '#fff' }]}>Δοκιμή</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1 }]}
          onPress={resetNotifications}
        >
          <Text style={[s.btnText, { color: c.text }]}>Επαναφορά ειδοποιήσεων</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, { borderColor: c.danger, borderWidth: 1 }]}
          onPress={disableNotifications}
        >
          <Text style={[s.btnText, { color: c.danger }]}>Απενεργοποίηση όλων</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '700', marginBottom: 24, marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  emptyCard: { borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1 },
  emptyText: { fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, gap: 12 },
  timeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 62, alignItems: 'center' },
  timeText: { fontSize: 14, fontWeight: '700' },
  cardBody: { flex: 1, fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 24, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnHalf: { flex: 1 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
