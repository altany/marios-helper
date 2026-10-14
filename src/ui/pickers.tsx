import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { caps } from '../lib/text';
import { dateKey, hhmmToMinutes, minutesToHHMM, pad } from '../lib/time';
import { radius, useColors } from './theme';

const months = () =>
  t(
    [
      'Ιανουάριος',
      'Φεβρουάριος',
      'Μάρτιος',
      'Απρίλιος',
      'Μάιος',
      'Ιούνιος',
      'Ιούλιος',
      'Αύγουστος',
      'Σεπτέμβριος',
      'Οκτώβριος',
      'Νοέμβριος',
      'Δεκέμβριος',
    ],
    [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  );
/** Monday first. */
const weekHead = () => t(['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

const Cell = ({
  label,
  selected,
  dim,
  onPress,
}: {
  label: string;
  selected?: boolean;
  dim?: boolean;
  onPress: () => void;
}) => {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [p.cell, { backgroundColor: selected ? c.accent : c.input, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[p.cellText, { color: selected ? '#fff' : dim ? c.textMuted : c.text }]}>{label}</Text>
    </Pressable>
  );
};

/** Pick a time: tap the hour, then the minutes. ± buttons for single minutes. */
export const TimePicker = ({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) => {
  const c = useColors();
  const [h, m] = value.split(':').map(Number);
  const set = (hour: number, minute: number) => onChange(`${pad(hour)}:${pad(minute)}`);
  const nudge = (d: number) => onChange(minutesToHHMM(hhmmToMinutes(value) + d));
  return (
    <View style={{ gap: 12 }}>
      <View style={p.display}>
        <Pressable onPress={() => nudge(-1)} hitSlop={8} style={[p.nudge, { backgroundColor: c.input }]}>
          <Ionicons name="remove" size={22} color={c.text} />
        </Pressable>
        <Text style={[p.big, { color: c.text }]}>{value}</Text>
        <Pressable onPress={() => nudge(1)} hitSlop={8} style={[p.nudge, { backgroundColor: c.input }]}>
          <Ionicons name="add" size={22} color={c.text} />
        </Pressable>
      </View>
      <Text style={[p.caption, { color: c.textSoft }]}>{caps(t('Ώρα', 'Hour'))}</Text>
      <View style={p.grid}>
        {Array.from({ length: 24 }, (_, hour) => (
          <Cell key={hour} label={pad(hour)} selected={hour === h} onPress={() => set(hour, m)} />
        ))}
      </View>
      <Text style={[p.caption, { color: c.textSoft }]}>{caps(t('Λεπτά', 'Minutes'))}</Text>
      <View style={p.grid}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
          <Cell key={minute} label={`:${pad(minute)}`} selected={minute === m} onPress={() => set(h, minute)} />
        ))}
      </View>
    </View>
  );
};

/** Month calendar. */
export const DatePicker = ({ value, onChange }: { value?: string; onChange: (date: string) => void }) => {
  const c = useColors();
  const initial = value ? new Date(value + 'T00:00') : new Date();
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const today = dateKey(Date.now());

  const first = new Date(month.y, month.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const move = (d: number) =>
    setMonth(({ y, m }) => {
      const n = new Date(y, m + d, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });

  return (
    <View style={{ gap: 10 }}>
      <View style={p.monthRow}>
        <Pressable onPress={() => move(-1)} hitSlop={10} style={[p.nudge, { backgroundColor: c.input }]}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Text style={[p.month, { color: c.text }]}>
          {months()[month.m]} {month.y}
        </Text>
        <Pressable onPress={() => move(1)} hitSlop={10} style={[p.nudge, { backgroundColor: c.input }]}>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
      </View>
      <View style={p.week}>
        {weekHead().map((d, i) => (
          <Text key={i} style={[p.weekDay, { color: c.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={p.week}>
        {cells.map((d, i) => {
          if (d == null) return <View key={i} style={p.day} />;
          const key = `${month.y}-${pad(month.m + 1)}-${pad(d)}`;
          const selected = key === value;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(key)}
              style={[
                p.day,
                p.dayInner,
                selected && { backgroundColor: c.accent },
                !selected && key === today && { borderWidth: 1, borderColor: c.accent },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : c.text, fontSize: 15, fontWeight: '600' }}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const p = StyleSheet.create({
  display: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  big: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 140, textAlign: 'center' },
  nudge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: '15.8%', paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  cellText: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 17, fontWeight: '700' },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  day: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayInner: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
});
