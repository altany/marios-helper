import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RunView, StepView } from '../engine/runs';
import { caps } from '../lib/text';
import { formatFromNow, formatMinutes, MINUTE, toHHMM } from '../lib/time';
import { IconName, MedIcon } from './components';
import { Colors, radius, useColors } from './theme';

/** Choices for "Αργότερα" (5 minutes to 2 hours). */
export const SNOOZE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export const statusInfo = (
  run: RunView,
  step: StepView,
  now: number,
  c: Colors,
): { icon: IconName; color: string; text: string } => {
  const prev = run.steps[step.index - 1];
  switch (step.status) {
    case 'given':
      return { icon: 'checkmark-circle', color: c.success, text: `Δόθηκε ${toHHMM(step.markedAt!)}` };
    case 'skipped':
      return {
        icon: 'remove-circle-outline',
        color: c.textMuted,
        text: step.markedAt ? `Παραλείφθηκε ${toHHMM(step.markedAt)}` : 'Παραλείπεται',
      };
    case 'missed':
      return { icon: 'alert-circle-outline', color: c.danger, text: 'Δεν καταγράφηκε' };
    case 'due': {
      const late = Math.round((now - step.dueAt) / MINUTE);
      return {
        icon: 'notifications',
        color: c.warn,
        text: late >= 2 ? `Τώρα · καθυστέρηση ${formatMinutes(late)}` : 'Τώρα',
      };
    }
    case 'waiting':
      return {
        icon: 'hourglass-outline',
        color: c.textMuted,
        text: `${formatMinutes(step.waitMin)} μετά το ${prev?.name ?? 'προηγούμενο'}`,
      };
    case 'upcoming': {
      const soon = step.dueAt - now < 3 * 60 * MINUTE;
      const when = soon ? `${toHHMM(step.dueAt)} · ${formatFromNow(step.dueAt, now)}` : toHHMM(step.dueAt);
      return {
        icon: step.snoozed ? 'alarm-outline' : 'time-outline',
        color: step.snoozed ? c.warn : c.textSoft,
        text: step.snoozed ? `Αργότερα: ${when}` : when,
      };
    }
  }
};

/** One medicine line inside a run card. */
export const StepLine = ({ run, step, now }: { run: RunView; step: StepView; now: number }) => {
  const c = useColors();
  const info = statusInfo(run, step, now, c);
  const done = step.status === 'given' || step.status === 'skipped';
  return (
    <View style={d.stepLine}>
      <MedIcon kind={step.med?.kind} color={step.med?.color} size={34} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            d.stepName,
            { color: done ? c.textSoft : c.text },
            step.status === 'skipped' && { textDecorationLine: 'line-through' },
          ]}
          numberOfLines={1}
        >
          {step.name}
        </Text>
        <View style={d.statusRow}>
          <Ionicons name={info.icon} size={14} color={info.color} />
          <Text style={[d.statusText, { color: info.color }]} numberOfLines={1}>
            {info.text}
          </Text>
        </View>
      </View>
    </View>
  );
};

const runBadge = (run: RunView, c: Colors) => {
  switch (run.status) {
    case 'done':
      return { text: 'Έγινε', color: c.success, bg: c.successSoft };
    case 'active':
      return run.steps.some(st => st.status === 'due')
        ? { text: 'Τώρα', color: c.warn, bg: c.warnSoft }
        : { text: 'Σε εξέλιξη', color: c.accentText, bg: c.accentSoft };
    case 'missed':
      return { text: 'Χάθηκε', color: c.danger, bg: c.dangerSoft };
    case 'skipped':
      return { text: 'Παράλειψη', color: c.textSoft, bg: c.input };
    default:
      return null;
  }
};

/** A run of a routine in the day's timeline: time on the left, medicines on the right. */
export const RunCard = ({ run, now, onPress }: { run: RunView; now: number; onPress: () => void }) => {
  const c = useColors();
  const badge = runBadge(run, c);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        d.run,
        { backgroundColor: c.card, borderColor: run.steps.some(st => st.status === 'due') ? c.warn : c.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={d.timeCol}>
        <Text style={[d.time, { color: run.status === 'done' || run.skipped ? c.textSoft : c.text }]}>
          {toHHMM(run.startAt)}
        </Text>
        {run.moved && <Text style={[d.oldTime, { color: c.textMuted }]}>{run.time}</Text>}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={d.runHead}>
          <Text style={[d.runName, { color: c.textSoft }]} numberOfLines={1}>
            {caps(`${run.routineName || 'Ρουτίνα'}${run.moved ? ' · άλλαξε ώρα' : ''}`)}
          </Text>
          {badge && (
            <View style={[d.badge, { backgroundColor: badge.bg }]}>
              <Text style={[d.badgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          )}
        </View>
        {run.steps.map(step => (
          <StepLine key={step.index} run={run} step={step} now={now} />
        ))}
      </View>
    </Pressable>
  );
};

export const d = StyleSheet.create({
  run: { flexDirection: 'row', gap: 14, borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  timeCol: { width: 58, alignItems: 'flex-start' },
  time: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  oldTime: { fontSize: 13, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  runHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runName: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  stepLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepName: { fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  statusText: { fontSize: 13, fontWeight: '600' },
});
