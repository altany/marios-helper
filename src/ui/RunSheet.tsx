import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { moveRun, resetRunTime, setRunSkipped, unmarkStep } from '../engine/actions';
import { buildRun, RunView, StepView } from '../engine/runs';
import { t } from '../i18n';
import { formatDate, formatMinutes, hhmmToMinutes, MINUTE, minutesToHHMM, nearestAt, toHHMM } from '../lib/time';
import { act, giveStep, skipStep, snoozeStepFor } from '../notify/commands';
import { nextLine } from '../notify/content';
import { useData } from '../store/store';
import { Button, Chip, Divider, s, Sheet, useNow } from './components';
import { earlierStart, givenAt, SNOOZE_OPTIONS, StepLine } from './dose';
import { TimePicker } from './pickers';
import { useColors } from './theme';
import { toast } from './toast';

type Mode =
  | { kind: 'main' }
  | { kind: 'time'; value: string }
  | { kind: 'givenAt'; index: number; value: string }
  | { kind: 'snooze'; index: number };

const isOpen = (st: StepView) => st.status === 'due' || st.status === 'upcoming' || st.status === 'missed';

/** Everything you can do with one run: give, snooze, skip, undo, change its time just this once. */
export const RunSheet = ({ runId, onClose }: { runId: string | null; onClose: () => void }) => {
  const c = useColors();
  const data = useData();
  const now = useNow(15_000);
  const [mode, setMode] = useState<Mode>({ kind: 'main' });

  useEffect(() => setMode({ kind: 'main' }), [runId]);

  const run: RunView | null = data && runId ? buildRun(data, runId, now) : null;
  if (!run)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );

  const started = run.steps.some(st => st.markedAt != null);
  const title = `${run.routineName || t('Δόση', 'Dose')} · ${toHHMM(run.startAt)}`;

  const close = () => {
    setMode({ kind: 'main' });
    onClose();
  };

  if (mode.kind === 'time') {
    const shift = (min: number) => setMode({ kind: 'time', value: minutesToHHMM(hhmmToMinutes(mode.value) + min) });
    const save = async () => {
      const startAt = nearestAt(run.date, mode.value, run.plannedAt);
      await act(d => (startAt === run.plannedAt ? resetRunTime(d, run.id) : moveRun(d, run.id, startAt)));
      toast(t(`Νέα ώρα: ${mode.value}`, `New time: ${mode.value}`));
      setMode({ kind: 'main' });
    };
    return (
      <Sheet visible onClose={close} title={t('Αλλαγή ώρας μόνο αυτή τη φορά', 'Change the time just this once')}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            `${formatDate(run.date)} · κανονική ώρα ${run.time}. Οι άλλες μέρες δεν αλλάζουν.`,
            `${formatDate(run.date)} · usual time ${run.time}. Other days stay the same.`,
          )}
        </Text>
        <View style={s.wrap}>
          {[-60, -30, -15, 15, 30, 60, 120].map(m => (
            <Chip key={m} label={`${m > 0 ? '+' : '−'}${formatMinutes(Math.abs(m))}`} onPress={() => shift(m)} />
          ))}
        </View>
        <TimePicker value={mode.value} onChange={value => setMode({ kind: 'time', value })} />
        <Button label={t(`Αποθήκευση · ${mode.value}`, `Save · ${mode.value}`)} kind="primary" icon="checkmark" onPress={save} />
        <Button label={t('Πίσω', 'Back')} kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  if (mode.kind === 'givenAt') {
    const step = run.steps[mode.index];
    const save = async () => {
      await giveStep(run.id, mode.index, givenAt(run.date, mode.value, now));
      toast(t(`${step.name}: δόθηκε ${mode.value}`, `${step.name}: given at ${mode.value}`));
      setMode({ kind: 'main' });
    };
    return (
      <Sheet visible onClose={close} title={t(`Πότε δόθηκε το ${step.name};`, `When was ${step.name} given?`)}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            'Το επόμενο φάρμακο της σειράς υπολογίζεται από αυτή την ώρα.',
            'The next medicine in the chain is timed from this.',
          )}
        </Text>
        <TimePicker value={mode.value} onChange={value => setMode({ ...mode, value })} />
        <Button label={t(`Δόθηκε στις ${mode.value}`, `Given at ${mode.value}`)} kind="success" icon="paw" onPress={save} />
        <Button label={t('Πίσω', 'Back')} kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  if (mode.kind === 'snooze') {
    const step = run.steps[mode.index];
    return (
      <Sheet visible onClose={close} title={t(`${step.name} αργότερα`, `${step.name} later`)}>
        <Text style={[s.hint, { color: c.textSoft }]}>{t('Θα ειδοποιηθείς ξανά σε:', 'Remind me again in:')}</Text>
        <View style={s.wrap}>
          {SNOOZE_OPTIONS.map(min => (
            <Chip
              key={min}
              label={`${formatMinutes(min)} · ${toHHMM(now + min * MINUTE)}`}
              onPress={async () => {
                await snoozeStepFor(run.id, mode.index, min);
                toast(t(`Υπενθύμιση στις ${toHHMM(Date.now() + min * MINUTE)}`, `Reminder at ${toHHMM(Date.now() + min * MINUTE)}`));
                close();
              }}
            />
          ))}
        </View>
        <Button label={t('Πίσω', 'Back')} kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  return (
    <Sheet visible onClose={close} title={title}>
      <Text style={[s.hint, { color: c.textSoft }]}>
        {formatDate(run.date)}
        {run.moved ? t(` · κανονικά στις ${run.time}`, ` · usually at ${run.time}`) : ''}
        {run.followed
          ? t(
              ` · μετράει από την προηγούμενη δόση (κανονικά ${run.time})`,
              ` · timed from the previous dose (usually ${run.time})`,
            )
          : ''}
      </Text>

      {run.steps.map(step => (
        <View key={step.index} style={{ gap: 10 }}>
          <StepLine run={run} step={step} now={now} />
          {isOpen(step) && !run.skipped && (
            <>
              {!!step.med?.dose && (
                <Text style={[s.hint, { color: c.text, marginLeft: 44 }]}>
                  {step.med.dose}
                  {step.med.notes ? `\n${step.med.notes}` : ''}
                  {nextLine(run, step) ? `\n${nextLine(run, step)}` : ''}
                </Text>
              )}
              <Button
                label={t('Το έδωσα τώρα', 'I gave it now')}
                kind="success"
                icon="paw"
                onPress={async () => {
                  await giveStep(run.id, step.index);
                  toast(t(`${step.name}: δόθηκε`, `${step.name}: given`));
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  small
                  style={{ flex: 1 }}
                  label={t('Νωρίτερα', 'Earlier')}
                  onPress={() => setMode({ kind: 'givenAt', index: step.index, value: earlierStart(step, now) })}
                />
                {step.status !== 'missed' && (
                  <Button
                    small
                    style={{ flex: 1 }}
                    label={t('Αργότερα', 'Later')}
                    onPress={() => setMode({ kind: 'snooze', index: step.index })}
                  />
                )}
                <Button
                  small
                  style={{ flex: 1 }}
                  label={t('Παράλειψη', 'Skip')}
                  onPress={() =>
                    Alert.alert(
                      t('Παράλειψη', 'Skip'),
                      t(`Να μη δοθεί το ${step.name} αυτή τη φορά;`, `Skip ${step.name} this time?`),
                      [
                        { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
                        { text: t('Παράλειψη', 'Skip'), style: 'destructive', onPress: () => skipStep(run.id, step.index) },
                      ],
                    )
                  }
                />
              </View>
            </>
          )}
          {step.markedAt != null && (
            <Button
              small
              kind="ghost"
              label={t('Αναίρεση', 'Undo')}
              icon="arrow-undo-outline"
              style={{ alignSelf: 'flex-start', marginLeft: 36 }}
              onPress={() => act(d => unmarkStep(d, run.id, step.index))}
            />
          )}
          <Divider />
        </View>
      ))}

      {!started && !run.skipped && run.status !== 'missed' && (
        <Button
          label={t('Αλλαγή ώρας μόνο αυτή τη φορά', 'Change the time just this once')}
          icon="time-outline"
          onPress={() => setMode({ kind: 'time', value: toHHMM(run.startAt) })}
        />
      )}
      {run.moved && !started && (
        <Button
          label={t(`Επαναφορά στις ${run.time}`, `Back to ${run.time}`)}
          kind="ghost"
          icon="refresh"
          onPress={async () => {
            await act(d => resetRunTime(d, run.id));
            toast(t(`Ξανά στις ${run.time}`, `Back at ${run.time}`));
          }}
        />
      )}
      {!started && !run.skipped && (
        <Button
          label={t('Παράλειψη όλης της δόσης', 'Skip the whole dose')}
          kind="danger"
          icon="close-circle-outline"
          onPress={() =>
            Alert.alert(
              t('Παράλειψη', 'Skip'),
              t('Να μη δοθεί καθόλου αυτή η δόση; Δε θα έρθει ειδοποίηση.', 'Skip this whole dose? No reminder will come.'),
              [
                { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
                {
                  text: t('Παράλειψη', 'Skip'),
                  style: 'destructive',
                  onPress: async () => {
                    await act(d => setRunSkipped(d, run.id, true));
                    close();
                  },
                },
              ],
            )
          }
        />
      )}
      {run.skipped && (
        <Button
          label={t('Αναίρεση παράλειψης', 'Undo skip')}
          icon="arrow-undo-outline"
          onPress={() => act(d => setRunSkipped(d, run.id, false))}
        />
      )}
    </Sheet>
  );
};
