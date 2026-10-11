import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { buildRun, dueSteps } from '../engine/runs';
import { caps } from '../lib/text';
import { formatMinutes, MINUTE, toHHMM } from '../lib/time';
import { giveStep, skipStep, snoozeStepFor } from '../notify/commands';
import { nextLine } from '../notify/content';
import { onPrompt } from '../notify/events';
import { getData, useData } from '../store/store';
import { Button, Chip, MedIcon, s, useNow } from './components';
import { SNOOZE_OPTIONS } from './dose';
import { radius, useColors } from './theme';
import { toast } from './toast';

type Target = { runId: string; index: number };

/**
 * The big "time for a medicine" window shown when a reminder fires while the
 * app is open, or when a notification is tapped. Closing it keeps the reminder.
 */
export const DosePrompt = () => {
  const c = useColors();
  const data = useData();
  const now = useNow(15_000);
  const [target, setTarget] = useState<Target | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  useEffect(() => onPrompt(t => setTarget(t)), []);
  useEffect(() => setSnoozeOpen(false), [target]);

  useEffect(() => {
    if (!target) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setTarget(null);
      return true;
    });
    return () => sub.remove();
  }, [target]);

  const run = data && target ? buildRun(data, target.runId, now) : null;
  const step = run && target ? run.steps[target.index] : null;
  const open = !!step && (step.status === 'due' || step.status === 'upcoming' || step.status === 'missed');

  /** After answering, show the next medicine that is due, if any. */
  const done = async (msg: string) => {
    toast(msg);
    const next = dueSteps(await getData(), Date.now())[0];
    setTarget(next ? { runId: next.run.id, index: next.step.index } : null);
  };

  if (!open || !run || !step) return null;

  const late = Math.round((now - step.dueAt) / MINUTE);
  const after = nextLine(run, step);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setTarget(null)} statusBarTranslucent>
      <View style={[st.overlay, { backgroundColor: c.overlay }]}>
        <View style={[st.box, { backgroundColor: c.card }]}>
          <View style={st.top}>
            <Image source={require('../../assets/images/mario-avatar.png')} style={st.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={[st.kicker, { color: c.accentText }]}>
                {caps(`${data!.settings.petName} · ${run.routineName || 'Φάρμακο'}`)}
              </Text>
              <Text style={[s.hint, { color: c.textSoft }]}>
                {step.status === 'upcoming'
                  ? `Προγραμματισμένο για ${toHHMM(step.dueAt)}`
                  : late >= 2
                    ? `Από τις ${toHHMM(step.dueAt)} · πριν ${formatMinutes(late)}`
                    : `Ώρα ${toHHMM(step.dueAt)}`}
              </Text>
            </View>
          </View>

          <View style={st.med}>
            <MedIcon kind={step.med?.kind} color={step.med?.color} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[st.name, { color: c.text }]}>{step.name}</Text>
              {!!step.med?.dose && <Text style={[st.dose, { color: c.text }]}>{step.med.dose}</Text>}
            </View>
          </View>
          {!!step.med?.notes && <Text style={[st.notes, { color: c.textSoft }]}>{step.med.notes}</Text>}
          {!!after && (
            <View style={[st.next, { backgroundColor: c.accentSoft }]}>
              <Text style={{ color: c.accentText, fontWeight: '700' }}>{after}</Text>
            </View>
          )}

          <Button
            label="Το έδωσα"
            kind="success"
            icon="checkmark-circle"
            onPress={async () => {
              await giveStep(run.id, step.index);
              await done(`${step.name} ✓`);
            }}
          />

          {snoozeOpen ? (
            <View style={s.wrap}>
              {SNOOZE_OPTIONS.map(min => (
                <Chip
                  key={min}
                  label={formatMinutes(min)}
                  onPress={async () => {
                    await snoozeStepFor(run.id, step.index, min);
                    await done(`Υπενθύμιση στις ${toHHMM(Date.now() + min * MINUTE)}`);
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} label="Αργότερα" onPress={() => setSnoozeOpen(true)} />
              <Button
                style={{ flex: 1 }}
                label="Παράλειψη"
                onPress={async () => {
                  await skipStep(run.id, step.index);
                  await done(`${step.name}: παράλειψη`);
                }}
              />
            </View>
          )}
          <Button label="Κλείσιμο" kind="ghost" onPress={() => setTarget(null)} />
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  box: { borderRadius: 24, padding: 20, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  med: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 26, fontWeight: '800' },
  dose: { fontSize: 17, lineHeight: 23, marginTop: 2 },
  notes: { fontSize: 15, lineHeight: 21 },
  next: { borderRadius: radius.md, padding: 12 },
});
