import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { saveRoutine } from '../../src/engine/actions';
import { listRuns } from '../../src/engine/runs';
import { t } from '../../src/i18n';
import {
  addDays,
  dateKey,
  dayShort,
  formatDate,
  formatMinutes,
  hhmmToMinutes,
  relativeDay,
  toHHMM,
} from '../../src/lib/time';
import { AppData, Routine } from '../../src/model/types';
import { act } from '../../src/notify/commands';
import { useData } from '../../src/store/store';
import { Button, Card, EmptyState, Loading, MedIcon, s, Screen, SectionTitle, useNow } from '../../src/ui/components';
import { RunSheet } from '../../src/ui/RunSheet';
import { Colors, useColors } from '../../src/ui/theme';

const daysLabel = (days: number[]) =>
  days.length === 0 || days.length === 7
    ? t('Κάθε μέρα', 'Every day')
    : [1, 2, 3, 4, 5, 6, 0]
        .filter(d => days.includes(d))
        .map(d => dayShort()[d])
        .join(', ');

/** "Blinkdrops → 20′ → Tearshield" with coloured dots. */
const Chain = ({ data, routine, c }: { data: AppData; routine: Routine; c: Colors }) => (
  <View style={st.chain}>
    {routine.steps.map((step, i) => {
      const med = data.meds.find(m => m.id === step.medId);
      return (
        <React.Fragment key={step.id}>
          {i > 0 && (
            <Text style={[st.wait, { color: c.textMuted }]}>
              → {step.waitMin > 0 ? `${formatMinutes(step.waitMin)} →` : ''}
            </Text>
          )}
          <View style={st.chainMed}>
            <View style={[st.dot, { backgroundColor: med?.color ?? c.textMuted }]} />
            <Text style={[st.chainName, { color: c.text }]}>{med?.name ?? '—'}</Text>
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

export default function ScheduleScreen() {
  const c = useColors();
  const data = useData();
  const now = useNow();
  const [openRun, setOpenRun] = useState<string | null>(null);
  if (!data) return <Loading />;

  const today = dateKey(now);

  // A typical day: every time with the routines that run then.
  const slots = new Map<string, Routine[]>();
  for (const r of data.routines.filter(r => r.enabled && r.steps.length > 0)) {
    for (const time of r.times) slots.set(time, [...(slots.get(time) ?? []), r]);
  }
  const times = Array.from(slots.keys()).sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));

  const upcoming = listRuns(data, today, addDays(today, 3), now).filter(
    r => r.status === 'upcoming' || (r.status === 'skipped' && r.startAt > now),
  );

  return (
    <>
      <Screen
        title={t('Πρόγραμμα', 'Schedule')}
        subtitle={t(`Μια συνηθισμένη μέρα του ${data.settings.petName}`, `A normal day for ${data.settings.petName}`)}
      >
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {times.length === 0 && <EmptyState dog="dog-side" text={t('Δεν υπάρχει πρόγραμμα ακόμα.', 'No schedule yet.')} />}
          {times.map((time, i) => (
            <View
              key={time}
              style={[st.slot, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            >
              <Text style={[st.slotTime, { color: c.text }]}>{time}</Text>
              <View style={{ flex: 1, gap: 10 }}>
                {slots.get(time)!.map(r => (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push(`/routine/${r.id}`)}
                    style={({ pressed }) => [{ gap: 2 }, pressed && { opacity: 0.6 }]}
                  >
                    <Chain data={data} routine={r} c={c} />
                    <Text style={[s.hint, { color: c.textMuted }]}>
                      {[r.name, r.days.length > 0 && r.days.length < 7 ? daysLabel(r.days) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </Card>

        <SectionTitle>{t('Ρουτίνες', 'Routines')}</SectionTitle>
        <Text style={[s.hint, { color: c.textSoft, paddingHorizontal: 4 }]}>
          {t(
            'Μια ρουτίνα είναι φάρμακα που δίνονται το ένα μετά το άλλο, τις ίδιες ώρες. Το επόμενο έρχεται όσα λεπτά ορίσεις μετά από τη στιγμή που πάτησες «Το έδωσα».',
            'A routine is medicines given one after the other, at the same times. The next one comes as many minutes as you set after you tap "I gave it".',
          )}
        </Text>
        {data.routines.map(r => (
          <Card key={r.id} onPress={() => router.push(`/routine/${r.id}`)} style={!r.enabled && { opacity: 0.55 }}>
            <View style={st.routineHead}>
              <Text style={[st.routineName, { color: c.text }]} numberOfLines={1}>
                {r.name || t('Ρουτίνα', 'Routine')}
              </Text>
              <Switch
                value={r.enabled}
                onValueChange={enabled => void act(d => saveRoutine(d, { ...r, enabled }))}
                trackColor={{ false: c.input, true: c.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.wrap}>
              {r.times.map(time => (
                <View key={time} style={[st.time, { backgroundColor: c.accentSoft }]}>
                  <Text style={[st.timeText, { color: c.accentText }]}>{time}</Text>
                </View>
              ))}
              <Text style={[s.hint, { color: c.textSoft, alignSelf: 'center' }]}>{daysLabel(r.days)}</Text>
            </View>
            <Chain data={data} routine={r} c={c} />
          </Card>
        ))}
        <Button
          label={t('Νέα ρουτίνα', 'New routine')}
          kind="primary"
          icon="add"
          onPress={() => router.push('/routine/new')}
        />

        <SectionTitle>{t('Επόμενες ειδοποιήσεις', 'Next reminders')}</SectionTitle>
        <Text style={[s.hint, { color: c.textSoft, paddingHorizontal: 4 }]}>
          {t(
            'Πάτα μια ειδοποίηση για να αλλάξεις την ώρα της μόνο εκείνη τη μέρα ή να την παραλείψεις.',
            'Tap a reminder to change its time for that day only, or to skip it.',
          )}
        </Text>
        {upcoming.length === 0 && (
          <Card>
            <EmptyState
              icon="notifications-off-outline"
              text={t('Καμία ειδοποίηση τις επόμενες μέρες.', 'No reminders in the next few days.')}
            />
          </Card>
        )}
        {Array.from(new Set(upcoming.map(r => r.date))).map(day => (
          <Card key={day} style={{ gap: 0, paddingVertical: 4 }}>
            <Text style={[st.agendaDay, { color: c.accentText }]}>
              {relativeDay(day, today)}
              {relativeDay(day, today) !== formatDate(day) ? ` · ${formatDate(day)}` : ''}
            </Text>
            {upcoming
              .filter(r => r.date === day)
              .map(run => (
                <Pressable
                  key={run.id}
                  onPress={() => setOpenRun(run.id)}
                  style={({ pressed }) => [
                    st.agendaRow,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <View style={{ width: 62 }}>
                    <Text
                      style={[
                        st.agendaTime,
                        { color: run.skipped ? c.textMuted : run.moved || run.followed ? c.warn : c.text },
                        run.skipped && { textDecorationLine: 'line-through' },
                      ]}
                    >
                      {toHHMM(run.startAt)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {run.steps.slice(0, 3).map(step => (
                        <MedIcon key={step.index} kind={step.med?.kind} color={step.med?.color} size={22} />
                      ))}
                      <Text style={[st.agendaMeds, { color: c.text }]} numberOfLines={1}>
                        {run.steps.map(st2 => st2.name).join(' → ')}
                      </Text>
                    </View>
                    <Text style={[s.hint, { color: run.skipped ? c.danger : run.moved || run.followed ? c.warn : c.textMuted }]}>
                      {run.skipped
                        ? t('Παραλείπεται', 'Skipping')
                        : run.moved
                          ? t(`Άλλαξε από ${run.time}`, `Moved from ${run.time}`)
                          : run.followed
                            ? t(`Από την προηγούμενη δόση · κανονικά ${run.time}`, `From the previous dose · usually ${run.time}`)
                            : run.routineName}
                    </Text>
                  </View>
                  <Ionicons name="create-outline" size={20} color={c.textMuted} />
                </Pressable>
              ))}
          </Card>
        ))}
      </Screen>
      <RunSheet runId={openRun} onClose={() => setOpenRun(null)} />
    </>
  );
}

const st = StyleSheet.create({
  slot: { flexDirection: 'row', gap: 14, paddingVertical: 12 },
  slotTime: { width: 56, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chainMed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chainName: { fontSize: 16, fontWeight: '700' },
  wait: { fontSize: 14, fontWeight: '600' },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineName: { flex: 1, fontSize: 19, fontWeight: '800' },
  time: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  timeText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  agendaDay: { fontSize: 14, fontWeight: '800', paddingVertical: 10 },
  agendaTime: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  agendaMeds: { flex: 1, fontSize: 15, fontWeight: '700' },
});
