import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { shiftDay } from '../../src/engine/actions';
import { dueSteps, nextUpcoming, RunView, runsForDay, StepView } from '../../src/engine/runs';
import { t } from '../../src/i18n';
import {
  addDays,
  dateKey,
  formatDate,
  formatFromNow,
  formatMinutes,
  formatMinutesShort,
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
import { PhysioCard } from '../../src/ui/physio';
import { RunSheet } from '../../src/ui/RunSheet';
import { Colors, rounded, useColors } from '../../src/ui/theme';
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
            <IconButton icon="stats-chart-outline" label={t('Ιστορικό', 'History')} onPress={() => router.push('/history')} />
            <Image
              source={require('../../assets/images/mario-avatar.png')}
              style={[st.avatar, { borderColor: c.bandana }]}
            />
          </View>
        }
      >
        {updateReady && (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
            <Text style={[st.progressText, { color: c.text }]}>{t('Υπάρχει νέα έκδοση', "There's a new version")}</Text>
            <Text style={[s.hint, { color: c.textSoft }]}>
              {t(
                'Κατέβηκε ήδη. Πάτα για να ξεκινήσει η εφαρμογή με τη νέα έκδοση.',
                "It's already downloaded. Tap to restart the app with the new version.",
              )}
            </Text>
            <Button
              small
              kind="primary"
              label={t('Επανεκκίνηση', 'Restart')}
              icon="refresh"
              style={{ alignSelf: 'flex-start' }}
              onPress={restartWithUpdate}
            />
          </Card>
        )}

        {data.settings.paused && (
          <Card style={{ backgroundColor: c.warnSoft, borderColor: 'transparent' }}>
            <Text style={[st.progressText, { color: c.text }]}>
              {t('Οι ειδοποιήσεις είναι σε παύση', 'Reminders are paused')}
            </Text>
            <Text style={[s.hint, { color: c.textSoft }]}>
              {t('Δεν θα έρθει καμία ειδοποίηση μέχρι να τις ενεργοποιήσεις.', 'No reminders will come until you turn them on.')}
            </Text>
            <Button
              small
              kind="primary"
              label={t('Ενεργοποίηση', 'Turn on')}
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
          <IconButton icon="chevron-back" label={t('Προηγούμενη μέρα', 'Previous day')} onPress={() => setDate(addDays(date, -1))} />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {!isToday && <Chip label={t('Σήμερα', 'Today')} onPress={() => setDate(today)} />}
            {isToday && <Chip label={t('Αύριο', 'Tomorrow')} onPress={() => setDate(addDays(today, 1))} />}
          </View>
          <IconButton icon="chevron-forward" label={t('Επόμενη μέρα', 'Next day')} onPress={() => setDate(addDays(date, 1))} />
        </View>

        {total > 0 && (isToday || isPast) && (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[st.progressText, { color: c.text }]}>
                {t(`Δόθηκαν ${given} από ${total}`, `Given ${given} of ${total}`)}
              </Text>
              {given === total && (
                <View style={st.bravo}>
                  <MaterialCommunityIcons name="bone" size={18} color={c.success} />
                  <Text style={[st.bravoText, { color: c.success }]}>
                    {t(`Μπράβο ${data.settings.petName}!`, `Well done, ${data.settings.petName}!`)}
                  </Text>
                </View>
              )}
            </View>
            <PawTrail runs={runs} c={c} />
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

        <PhysioCard data={data} date={date} now={now} />

        <SectionTitle>{isPast ? t('Τι δόθηκε', 'What was given') : t('Πρόγραμμα ημέρας', "The day's schedule")}</SectionTitle>
        {data.routines.length === 0 ? (
          <Card>
            <EmptyState
              dog="dog-side"
              text={t(
                'Δεν υπάρχει ακόμα πρόγραμμα. Ξεκίνα με μια ρουτίνα: ποιο φάρμακο και τι ώρες.',
                'No schedule yet. Start with a routine: which medicine, and at what times.',
              )}
            />
            <Button
              label={t('Νέα ρουτίνα', 'New routine')}
              kind="primary"
              icon="add"
              onPress={() => router.push('/routine/new')}
            />
          </Card>
        ) : runs.length === 0 ? (
          <Card>
            <EmptyState
              dog={isPast ? 'dog-side' : 'bone'}
              text={
                isPast
                  ? t('Δεν υπάρχει τίποτα καταγεγραμμένο.', 'Nothing recorded.')
                  : t('Κανένα φάρμακο αυτή τη μέρα. Μόνο βόλτες και κόκαλα!', 'No medicines this day. Just walks and bones!')
              }
            />
          </Card>
        ) : (
          runs.map(run => <RunCard key={run.id} run={run} now={now} onPress={() => setOpenRun(run.id)} />)
        )}

        {!isPast && pending > 0 && (
          <Button
            label={t('Αλλαγή ώρας για όλη τη μέρα', 'Move the whole day')}
            kind="ghost"
            icon="swap-vertical"
            onPress={() => setShiftOpen(true)}
          />
        )}
        {runs.length > 0 && (
          <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>
            {t(
              'Πάτα μια δόση για να αλλάξεις την ώρα της, να την παραλείψεις ή να τη σημειώσεις.',
              'Tap a dose to change its time, skip it or mark it as given.',
            )}
          </Text>
        )}
      </Screen>

      <RunSheet runId={openRun} onClose={() => setOpenRun(null)} />

      <Sheet
        visible={shiftOpen}
        onClose={() => setShiftOpen(false)}
        title={t('Αλλαγή ώρας για όλη τη μέρα', 'Move the whole day')}
      >
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            `Μετακινεί όλες τις δόσεις της ${relativeDay(date, today).toLowerCase()} που δεν έχουν ξεκινήσει ακόμα. Οι άλλες μέρες δεν αλλάζουν.`,
            `Moves every dose ${date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : `on ${formatDate(date)}`} that hasn't started yet. Other days stay the same.`,
          )}
        </Text>
        <View style={s.wrap}>
          {[-60, -30, -15, 15, 30, 60, 90, 120].map(min => (
            <Chip
              key={min}
              label={`${min > 0 ? '+' : '−'}${formatMinutes(Math.abs(min))}`}
              onPress={async () => {
                await act(d => shiftDay(d, date, min, Date.now()));
                toast(
                  t(
                    `Όλες οι δόσεις: ${min > 0 ? '+' : '−'}${formatMinutes(Math.abs(min))}`,
                    `All doses: ${min > 0 ? '+' : '−'}${formatMinutes(Math.abs(min))}`,
                  ),
                );
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
          {caps(
            t(
              `Τώρα · ${toHHMM(step.dueAt)}${late >= 2 ? ` · καθυστέρηση ${formatMinutes(late)}` : ''}`,
              `Now · ${toHHMM(step.dueAt)}${late >= 2 ? ` · ${formatMinutes(late)} late` : ''}`,
            ),
          )}
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
          label={t('Το έδωσα', 'I gave it')}
          kind="success"
          icon="paw"
          onPress={async () => {
            await giveStep(run.id, step.index);
            toast(t(`${step.name}: δόθηκε`, `${step.name}: given`));
          }}
        />
        <Button
          style={{ flex: 1 }}
          label={formatMinutesShort(snoozeMin)}
          icon="alarm-outline"
          onPress={async () => {
            await snoozeStepFor(run.id, step.index, snoozeMin);
            toast(
              t(
                `Υπενθύμιση στις ${toHHMM(Date.now() + snoozeMin * MINUTE)}`,
                `Reminder at ${toHHMM(Date.now() + snoozeMin * MINUTE)}`,
              ),
            );
          }}
        />
        <Pressable
          onPress={onMore}
          accessibilityLabel={t('Περισσότερα', 'More')}
          style={[st.more, { backgroundColor: c.input }]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
        </Pressable>
      </View>
    </Card>
  );
};

/** One paw print per dose of the day, filled in as they are given. */
const PawTrail = ({ runs, c }: { runs: RunView[]; c: Colors }) => (
  <View style={st.trail}>
    {runs
      .flatMap(run => run.steps)
      .map((step, i) => {
        const filled = step.status === 'given' || step.status === 'skipped';
        const color = {
          given: c.accent,
          skipped: c.textMuted,
          missed: c.danger,
          due: c.warn,
          waiting: c.textMuted,
          upcoming: c.textMuted,
        }[step.status];
        return (
          <Ionicons
            key={step.notifId}
            name={filled ? 'paw' : 'paw-outline'}
            size={20}
            color={color}
            style={{
              opacity: step.status === 'skipped' ? 0.5 : 1,
              transform: [{ rotate: i % 2 ? '14deg' : '-14deg' }, { translateY: i % 2 ? 3 : -3 }],
            }}
          />
        );
      })}
  </View>
);

const NextCard = ({ run, step, now, onPress }: { run: RunView; step: StepView; now: number; onPress: () => void }) => {
  const c = useColors();
  const prev = run.steps[step.index - 1];
  const chainWait = prev?.status === 'given';
  return (
    <Card onPress={onPress} style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
      <Text style={[st.dueKicker, { color: c.accentText }]}>
        {caps(chainWait ? t(`Μετά το ${prev.name}`, `After ${prev.name}`) : t('Επόμενο', 'Next'))}
      </Text>
      <View style={st.dueMed}>
        <MedIcon kind={step.med?.kind} color={step.med?.color} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[st.nextName, { color: c.text }]}>{step.name}</Text>
          <Text style={[s.hint, { color: c.textSoft }]}>
            {t(
              `${relativeDay(dateKey(step.dueAt), dateKey(now))} στις ${toHHMM(step.dueAt)} · ${formatFromNow(step.dueAt, now)}`,
              `${relativeDay(dateKey(step.dueAt), dateKey(now))} at ${toHHMM(step.dueAt)} · ${formatFromNow(step.dueAt, now)}`,
            )}
          </Text>
        </View>
        <Text style={[st.nextTime, { color: c.accentText }]}>{toHHMM(step.dueAt)}</Text>
      </View>
      {chainWait && (
        <Button
          small
          label={t('Το έδωσα ήδη', 'Already gave it')}
          icon="paw"
          onPress={async () => {
            await giveStep(run.id, step.index);
            toast(t(`${step.name}: δόθηκε`, `${step.name}: given`));
          }}
        />
      )}
    </Card>
  );
};

const st = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 16, fontWeight: '700' },
  bravo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bravoText: { fontSize: 15, fontWeight: '800' },
  trail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  dueHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueKicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  dueMed: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dueName: { ...rounded, fontSize: 25, lineHeight: 31 },
  dueDose: { fontSize: 16, lineHeight: 22 },
  nextName: { ...rounded, fontSize: 20, lineHeight: 26 },
  nextTime: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  more: { width: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
