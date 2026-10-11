import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { shiftDay } from '../../src/engine/actions';
import { dueSteps, nextUpcoming, RunView, runsForDay, StepView } from '../../src/engine/runs';
import {
  addDays,
  dateKey,
  formatDate,
  formatFromNow,
  formatMinutes,
  MINUTE,
  relativeDay,
  toHHMM,
} from '../../src/lib/time';
import { caps } from '../../src/lib/text';
import { act, giveStep, snoozeStepFor } from '../../src/notify/commands';
import { nextLine } from '../../src/notify/content';
import { useData } from '../../src/store/store';
import { restartWithUpdate, useUpdateReady } from '../../src/updates';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Loading,
  MedIcon,
  s,
  Screen,
  SectionTitle,
  Sheet,
  useNow,
} from '../../src/ui/components';
import { RunCard } from '../../src/ui/dose';
import { RunSheet } from '../../src/ui/RunSheet';
import { useColors } from '../../src/ui/theme';
import { toast } from '../../src/ui/toast';

export default function TodayScreen() {
  const c = useColors();
  const data = useData();
  const now = useNow();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = dateKey(now);
  const [date, setDate] = useState(today);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const updateReady = useUpdateReady();

  useEffect(() => {
    if (params.date) setDate(params.date);
  }, [params.date]);

  // Left open past midnight: move on to the new day.
  useEffect(() => {
    setDate(prev => (prev === addDays(today, -1) ? today : prev));
  }, [today]);

  if (!data) return <Loading />;

  const runs = runsForDay(data, date, now);
  const isToday = date === today;
  const isPast = date < today;
  const due = isToday ? dueSteps(data, now) : [];
  const next = isToday && due.length === 0 ? nextUpcoming(data, now) : null;
  const total = runs.reduce((n, r) => n + r.steps.length, 0);
  const given = runs.reduce((n, r) => n + r.givenCount, 0);
  const pending = runs.filter(r => r.status === 'upcoming').length;

  return (
    <>
      <Screen
        title={relativeDay(date, today)}
        subtitle={formatDate(date)}
        right={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <IconButton icon="stats-chart-outline" label="Ιστορικό" onPress={() => router.push('/history')} />
            <Image source={require('../../assets/images/mario-avatar.png')} style={st.avatar} />
          </View>
        }
      >
        {updateReady && (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
            <Text style={[st.progressText, { color: c.text }]}>Υπάρχει νέα έκδοση</Text>
            <Text style={[s.hint, { color: c.textSoft }]}>
              Κατέβηκε ήδη. Πάτα για να ξεκινήσει η εφαρμογή με τη νέα έκδοση.
            </Text>
            <Button
              small
              kind="primary"
              label="Επανεκκίνηση"
              icon="refresh"
              style={{ alignSelf: 'flex-start' }}
              onPress={restartWithUpdate}
            />
          </Card>
        )}

        {data.settings.paused && (
          <Card style={{ backgroundColor: c.warnSoft, borderColor: 'transparent' }}>
            <Text style={[st.progressText, { color: c.text }]}>Οι ειδοποιήσεις είναι σε παύση</Text>
            <Text style={[s.hint, { color: c.textSoft }]}>
              Δεν θα έρθει καμία ειδοποίηση μέχρι να τις ενεργοποιήσεις.
            </Text>
            <Button
              small
              kind="primary"
              label="Ενεργοποίηση"
              icon="notifications-outline"
              style={{ alignSelf: 'flex-start' }}
              onPress={() =>
                act(d => {
                  d.settings.paused = false;
                })
              }
            />
          </Card>
        )}

        <View style={st.dayNav}>
          <IconButton icon="chevron-back" label="Προηγούμενη μέρα" onPress={() => setDate(addDays(date, -1))} />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {!isToday && <Chip label="Σήμερα" onPress={() => setDate(today)} />}
            {isToday && <Chip label="Αύριο" onPress={() => setDate(addDays(today, 1))} />}
          </View>
          <IconButton icon="chevron-forward" label="Επόμενη μέρα" onPress={() => setDate(addDays(date, 1))} />
        </View>

        {total > 0 && (isToday || isPast) && (
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[st.progressText, { color: c.text }]}>
                Δόθηκαν {given} από {total}
              </Text>
              {given === total && <Text style={{ color: c.success, fontWeight: '800' }}>Μπράβο! 🐾</Text>}
            </View>
            <View style={[st.bar, { backgroundColor: c.input }]}>
              <View style={[st.barFill, { backgroundColor: c.success, width: `${(given / total) * 100}%` }]} />
            </View>
          </Card>
        )}

        {due.map(({ run, step }) => (
          <DueCard
            key={step.notifId}
            run={run}
            step={step}
            now={now}
            onMore={() => setOpenRun(run.id)}
            snoozeMin={data.settings.snoozeMin}
          />
        ))}

        {next && <NextCard run={next.run} step={next.step} now={now} onPress={() => setOpenRun(next.run.id)} />}

        <SectionTitle>{isPast ? 'Τι δόθηκε' : 'Πρόγραμμα ημέρας'}</SectionTitle>
        {data.routines.length === 0 ? (
          <Card>
            <EmptyState
              icon="paw-outline"
              text="Δεν υπάρχει ακόμα πρόγραμμα. Ξεκίνα με μια ρουτίνα: ποιο φάρμακο και τι ώρες."
            />
            <Button label="Νέα ρουτίνα" kind="primary" icon="add" onPress={() => router.push('/routine/new')} />
          </Card>
        ) : runs.length === 0 ? (
          <Card>
            <EmptyState
              icon="moon-outline"
              text={isPast ? 'Δεν υπάρχει τίποτα καταγεγραμμένο.' : 'Κανένα φάρμακο αυτή τη μέρα.'}
            />
          </Card>
        ) : (
          runs.map(run => <RunCard key={run.id} run={run} now={now} onPress={() => setOpenRun(run.id)} />)
        )}

        {!isPast && pending > 0 && (
          <Button
            label="Αλλαγή ώρας για όλη τη μέρα"
            kind="ghost"
            icon="swap-vertical"
            onPress={() => setShiftOpen(true)}
          />
        )}
        {runs.length > 0 && (
          <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>
            Πάτα μια δόση για να αλλάξεις την ώρα της, να την παραλείψεις ή να τη σημειώσεις.
          </Text>
        )}
      </Screen>

      <RunSheet runId={openRun} onClose={() => setOpenRun(null)} />

      <Sheet visible={shiftOpen} onClose={() => setShiftOpen(false)} title="Αλλαγή ώρας για όλη τη μέρα">
        <Text style={[s.hint, { color: c.textSoft }]}>
          Μετακινεί όλες τις δόσεις της {relativeDay(date, today).toLowerCase()} που δεν έχουν ξεκινήσει ακόμα. Οι άλλες
          μέρες δεν αλλάζουν.
        </Text>
        <View style={s.wrap}>
          {[-60, -30, -15, 15, 30, 60, 90, 120].map(min => (
            <Chip
              key={min}
              label={`${min > 0 ? '+' : '−'}${formatMinutes(Math.abs(min))}`}
              onPress={async () => {
                await act(d => shiftDay(d, date, min, Date.now()));
                toast(`Όλες οι δόσεις: ${min > 0 ? '+' : '−'}${formatMinutes(Math.abs(min))}`);
                setShiftOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}

const DueCard = ({
  run,
  step,
  now,
  onMore,
  snoozeMin,
}: {
  run: RunView;
  step: StepView;
  now: number;
  onMore: () => void;
  snoozeMin: number;
}) => {
  const c = useColors();
  const late = Math.round((now - step.dueAt) / MINUTE);
  const after = nextLine(run, step);
  return (
    <Card style={{ borderColor: c.warn, borderWidth: 2, gap: 12 }}>
      <View style={st.dueHead}>
        <Ionicons name="notifications" size={16} color={c.warn} />
        <Text style={[st.dueKicker, { color: c.warn }]}>
          {caps(`Τώρα · ${toHHMM(step.dueAt)}${late >= 2 ? ` · καθυστέρηση ${formatMinutes(late)}` : ''}`)}
        </Text>
      </View>
      <View style={st.dueMed}>
        <MedIcon kind={step.med?.kind} color={step.med?.color} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={[st.dueName, { color: c.text }]}>{step.name}</Text>
          {!!step.med?.dose && <Text style={[st.dueDose, { color: c.text }]}>{step.med.dose}</Text>}
          {!!step.med?.notes && <Text style={[s.hint, { color: c.textSoft }]}>{step.med.notes}</Text>}
        </View>
      </View>
      {!!after && <Text style={[s.hint, { color: c.accentText, fontWeight: '700' }]}>{after}</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          style={{ flex: 2 }}
          label="Το έδωσα"
          kind="success"
          icon="checkmark-circle"
          onPress={async () => {
            await giveStep(run.id, step.index);
            toast(`${step.name} ✓`);
          }}
        />
        <Button
          style={{ flex: 1 }}
          label={formatMinutes(snoozeMin)}
          icon="alarm-outline"
          onPress={async () => {
            await snoozeStepFor(run.id, step.index, snoozeMin);
            toast(`Υπενθύμιση στις ${toHHMM(Date.now() + snoozeMin * MINUTE)}`);
          }}
        />
        <Pressable onPress={onMore} accessibilityLabel="Περισσότερα" style={[st.more, { backgroundColor: c.input }]}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
        </Pressable>
      </View>
    </Card>
  );
};

const NextCard = ({ run, step, now, onPress }: { run: RunView; step: StepView; now: number; onPress: () => void }) => {
  const c = useColors();
  const prev = run.steps[step.index - 1];
  const chainWait = prev?.status === 'given';
  return (
    <Card onPress={onPress} style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
      <Text style={[st.dueKicker, { color: c.accentText }]}>
        {caps(chainWait ? `Μετά το ${prev.name}` : 'Επόμενο')}
      </Text>
      <View style={st.dueMed}>
        <MedIcon kind={step.med?.kind} color={step.med?.color} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[st.nextName, { color: c.text }]}>{step.name}</Text>
          <Text style={[s.hint, { color: c.textSoft }]}>
            {relativeDay(dateKey(step.dueAt), dateKey(now))} στις {toHHMM(step.dueAt)} ·{' '}
            {formatFromNow(step.dueAt, now)}
          </Text>
        </View>
        <Text style={[st.nextTime, { color: c.accentText }]}>{toHHMM(step.dueAt)}</Text>
      </View>
      {chainWait && (
        <Button
          small
          label="Το έδωσα ήδη"
          icon="checkmark"
          onPress={async () => {
            await giveStep(run.id, step.index);
            toast(`${step.name} ✓`);
          }}
        />
      )}
    </Card>
  );
};

const st = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 23 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 16, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  dueHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueKicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  dueMed: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dueName: { fontSize: 24, fontWeight: '800' },
  dueDose: { fontSize: 16, lineHeight: 22 },
  nextName: { fontSize: 20, fontWeight: '800' },
  nextTime: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  more: { width: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
