import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { markStep, moveRun, resetRunTime, setRunSkipped, unmarkStep } from '../engine/actions';
import { buildRun, RunView, StepView } from '../engine/runs';
import { atTime, formatDate, formatMinutes, hhmmToMinutes, MINUTE, minutesToHHMM, toHHMM } from '../lib/time';
import { act, giveStep, skipStep, snoozeStepFor } from '../notify/commands';
import { nextLine } from '../notify/content';
import { useData } from '../store/store';
import { Button, Chip, Divider, s, Sheet, useNow } from './components';
import { StepLine } from './dose';
import { TimePicker } from './pickers';
import { useColors } from './theme';
import { toast } from './toast';

export const SNOOZE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

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
  const title = `${run.routineName || 'Δόση'} · ${toHHMM(run.startAt)}`;

  const close = () => {
    setMode({ kind: 'main' });
    onClose();
  };

  if (mode.kind === 'time') {
    const shift = (min: number) => setMode({ kind: 'time', value: minutesToHHMM(hhmmToMinutes(mode.value) + min) });
    const save = async () => {
      const startAt = atTime(run.date, mode.value);
      await act(d => (startAt === run.plannedAt ? resetRunTime(d, run.id) : moveRun(d, run.id, startAt)));
      toast(`Νέα ώρα: ${mode.value}`);
      setMode({ kind: 'main' });
    };
    return (
      <Sheet visible onClose={close} title="Αλλαγή ώρας μόνο αυτή τη φορά">
        <Text style={[s.hint, { color: c.textSoft }]}>
          {formatDate(run.date)} · κανονική ώρα {run.time}. Οι άλλες μέρες δεν αλλάζουν.
        </Text>
        <View style={s.wrap}>
          {[-60, -30, -15, 15, 30, 60, 120].map(m => (
            <Chip key={m} label={`${m > 0 ? '+' : '−'}${formatMinutes(Math.abs(m))}`} onPress={() => shift(m)} />
          ))}
        </View>
        <TimePicker value={mode.value} onChange={value => setMode({ kind: 'time', value })} />
        <Button label={`Αποθήκευση · ${mode.value}`} kind="primary" icon="checkmark" onPress={save} />
        <Button label="Πίσω" kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  if (mode.kind === 'givenAt') {
    const step = run.steps[mode.index];
    const save = async () => {
      let at = atTime(run.date, mode.value);
      if (at > now + 12 * 60 * MINUTE) at -= 24 * 60 * MINUTE; // e.g. picked 23:50 just after midnight
      await act(d => markStep(d, run.id, mode.index, 'given', at));
      toast(`${step.name}: δόθηκε ${mode.value}`);
      setMode({ kind: 'main' });
    };
    return (
      <Sheet visible onClose={close} title={`Πότε δόθηκε το ${step.name};`}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          Το επόμενο φάρμακο της σειράς υπολογίζεται από αυτή την ώρα.
        </Text>
        <TimePicker value={mode.value} onChange={value => setMode({ ...mode, value })} />
        <Button label={`Δόθηκε στις ${mode.value}`} kind="success" icon="checkmark" onPress={save} />
        <Button label="Πίσω" kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  if (mode.kind === 'snooze') {
    const step = run.steps[mode.index];
    return (
      <Sheet visible onClose={close} title={`${step.name} αργότερα`}>
        <Text style={[s.hint, { color: c.textSoft }]}>Θα ειδοποιηθείς ξανά σε:</Text>
        <View style={s.wrap}>
          {SNOOZE_OPTIONS.map(min => (
            <Chip
              key={min}
              label={`${formatMinutes(min)} · ${toHHMM(now + min * MINUTE)}`}
              onPress={async () => {
                await snoozeStepFor(run.id, mode.index, min);
                toast(`Υπενθύμιση στις ${toHHMM(Date.now() + min * MINUTE)}`);
                close();
              }}
            />
          ))}
        </View>
        <Button label="Πίσω" kind="ghost" onPress={() => setMode({ kind: 'main' })} />
      </Sheet>
    );
  }

  return (
    <Sheet visible onClose={close} title={title}>
      <Text style={[s.hint, { color: c.textSoft }]}>
        {formatDate(run.date)}
        {run.moved ? ` · κανονικά στις ${run.time}` : ''}
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
                label="Το έδωσα τώρα"
                kind="success"
                icon="checkmark-circle"
                onPress={async () => {
                  await giveStep(run.id, step.index);
                  toast(`${step.name} ✓`);
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  small
                  style={{ flex: 1 }}
                  label="Νωρίτερα"
                  onPress={() =>
                    setMode({
                      kind: 'givenAt',
                      index: step.index,
                      value: toHHMM(Math.min(now, Math.max(step.dueAt, now - 30 * MINUTE))),
                    })
                  }
                />
                {step.status !== 'missed' && (
                  <Button
                    small
                    style={{ flex: 1 }}
                    label="Αργότερα"
                    onPress={() => setMode({ kind: 'snooze', index: step.index })}
                  />
                )}
                <Button
                  small
                  style={{ flex: 1 }}
                  label="Παράλειψη"
                  onPress={() =>
                    Alert.alert('Παράλειψη', `Να μη δοθεί το ${step.name} αυτή τη φορά;`, [
                      { text: 'Άκυρο', style: 'cancel' },
                      { text: 'Παράλειψη', style: 'destructive', onPress: () => skipStep(run.id, step.index) },
                    ])
                  }
                />
              </View>
            </>
          )}
          {step.markedAt != null && (
            <Button
              small
              kind="ghost"
              label="Αναίρεση"
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
          label="Αλλαγή ώρας μόνο αυτή τη φορά"
          icon="time-outline"
          onPress={() => setMode({ kind: 'time', value: toHHMM(run.startAt) })}
        />
      )}
      {run.moved && !started && (
        <Button
          label={`Επαναφορά στις ${run.time}`}
          kind="ghost"
          icon="refresh"
          onPress={async () => {
            await act(d => resetRunTime(d, run.id));
            toast(`Ξανά στις ${run.time}`);
          }}
        />
      )}
      {!started && !run.skipped && (
        <Button
          label="Παράλειψη όλης της δόσης"
          kind="danger"
          icon="close-circle-outline"
          onPress={() =>
            Alert.alert('Παράλειψη', 'Να μη δοθεί καθόλου αυτή η δόση; Δε θα έρθει ειδοποίηση.', [
              { text: 'Άκυρο', style: 'cancel' },
              {
                text: 'Παράλειψη',
                style: 'destructive',
                onPress: async () => {
                  await act(d => setRunSkipped(d, run.id, true));
                  close();
                },
              },
            ])
          }
        />
      )}
      {run.skipped && (
        <Button
          label="Αναίρεση παράλειψης"
          icon="arrow-undo-outline"
          onPress={() => act(d => setRunSkipped(d, run.id, false))}
        />
      )}
    </Sheet>
  );
};
