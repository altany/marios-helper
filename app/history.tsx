import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listRuns, RunView } from '../src/engine/runs';
import { addDays, dateKey, DAY_SHORT, daysBetween, MONTHS_SHORT, parseDateKey, relativeDay } from '../src/lib/time';
import { useData } from '../src/store/store';
import { Card, IconButton, Loading, s, Screen, SectionTitle, useNow } from '../src/ui/components';
import { Colors, useColors } from '../src/ui/theme';

const DAYS = 30;

const dayLabel = (day: string, today: string) => {
  if (Math.abs(daysBetween(today, day)) <= 1) return relativeDay(day, today);
  const d = parseDateKey(day);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

const dotColor = (status: RunView['status'], c: Colors) =>
  ({ done: c.success, active: c.warn, missed: c.danger, skipped: c.textMuted, upcoming: c.input })[status];

export default function History() {
  const c = useColors();
  const data = useData();
  const now = useNow(60_000);
  if (!data) return <Loading />;

  const today = dateKey(now);
  const from = addDays(today, -(DAYS - 1));
  const runs = listRuns(data, from, today, now);
  const byDay = new Map<string, RunView[]>();
  for (const r of runs) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);

  const pct = (list: RunView[]) => {
    const steps = list.flatMap(r => r.steps).filter(st => st.status !== 'upcoming' && st.status !== 'waiting');
    if (steps.length === 0) return null;
    return Math.round((steps.filter(st => st.status === 'given').length / steps.length) * 100);
  };
  const week = pct(runs.filter(r => r.date > addDays(today, -7)));
  const month = pct(runs);

  return (
    <Screen title="Ιστορικό" right={<IconButton icon="close" label="Κλείσιμο" onPress={() => router.back()} />}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[st.big, { color: c.text }]}>{week == null ? '—' : `${week}%`}</Text>
          <Text style={[s.hint, { color: c.textSoft }]}>δόσεις · 7 μέρες</Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[st.big, { color: c.text }]}>{month == null ? '—' : `${month}%`}</Text>
          <Text style={[s.hint, { color: c.textSoft }]}>δόσεις · 30 μέρες</Text>
        </Card>
      </View>

      <SectionTitle>Ανά μέρα</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {Array.from({ length: DAYS }, (_, i) => addDays(today, -i)).map((day, i) => {
          const list = byDay.get(day) ?? [];
          const given = list.reduce((n, r) => n + r.givenCount, 0);
          const total = list.reduce((n, r) => n + r.steps.length, 0);
          return (
            <Pressable
              key={day}
              onPress={() => router.navigate({ pathname: '/', params: { date: day } })}
              style={({ pressed }) => [
                st.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[st.day, { color: c.text }]}>{dayLabel(day, today)}</Text>
              <View style={st.dots}>
                {list.map(r => (
                  <View key={r.id} style={[st.dot, { backgroundColor: dotColor(r.status, c) }]} />
                ))}
              </View>
              <Text style={[st.count, { color: total && given === total ? c.success : c.textSoft }]}>
                {total ? `${given}/${total}` : '—'}
              </Text>
            </Pressable>
          );
        })}
      </Card>
      <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>
        Πράσινο: δόθηκε · Κόκκινο: δεν καταγράφηκε · Γκρι: παράλειψη
      </Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 30, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  day: { width: 104, fontSize: 15, fontWeight: '700' },
  dots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  count: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
