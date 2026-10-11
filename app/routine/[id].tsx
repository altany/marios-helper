import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteRoutine, saveMed, saveRoutine } from '../../src/engine/actions';
import { newId } from '../../src/lib/id';
import { DAY_SHORT, formatMinutes, sortTimes } from '../../src/lib/time';
import { MED_COLORS } from '../../src/model/defaults';
import { Medication, Routine } from '../../src/model/types';
import { act } from '../../src/notify/commands';
import { useData } from '../../src/store/store';
import {
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Loading,
  MedIcon,
  s,
  Screen,
  SectionTitle,
  Sheet,
  SwitchRow,
} from '../../src/ui/components';
import { TimePicker } from '../../src/ui/pickers';
import { useColors } from '../../src/ui/theme';
import { toast } from '../../src/ui/toast';

const WAITS = [0, 5, 10, 15, 20, 30, 45, 60];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function RoutineEditor() {
  const c = useColors();
  const data = useData();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Routine | null>(null);
  const [timeSheet, setTimeSheet] = useState<{ index: number | null; value: string } | null>(null);
  const [medSheet, setMedSheet] = useState<{ index: number | null } | null>(null);
  const [newMed, setNewMed] = useState({ name: '', dose: '' });

  useEffect(() => {
    if (!data || draft) return;
    const existing = data.routines.find(r => r.id === id);
    setDraft(
      existing
        ? JSON.parse(JSON.stringify(existing))
        : { id: newId(), name: '', times: [], days: [], steps: [], enabled: true, createdAt: Date.now() },
    );
  }, [data, id, draft]);

  if (!data || !draft) return <Loading />;
  const patch = (p: Partial<Routine>) => setDraft({ ...draft, ...p });
  const medOf = (medId: string) => data.meds.find(m => m.id === medId);

  const save = async () => {
    if (draft.steps.length === 0) return Alert.alert('Λείπει φάρμακο', 'Πρόσθεσε τουλάχιστον ένα φάρμακο.');
    if (draft.times.length === 0) return Alert.alert('Λείπει ώρα', 'Πρόσθεσε τουλάχιστον μία ώρα.');
    await act(d => saveRoutine(d, { ...draft, name: draft.name.trim(), times: sortTimes(draft.times) }));
    toast('Αποθηκεύτηκε');
    router.back();
  };

  const remove = () =>
    Alert.alert('Διαγραφή', `Να διαγραφεί η ρουτίνα «${draft.name || 'Ρουτίνα'}»; Το ιστορικό μένει.`, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: async () => {
          await act(d => deleteRoutine(d, draft.id));
          router.back();
        },
      },
    ]);

  const pickMed = (medId: string) => {
    if (!medSheet) return;
    const steps = [...draft.steps];
    if (medSheet.index == null) steps.push({ id: newId(), medId, waitMin: steps.length === 0 ? 0 : 20 });
    else steps[medSheet.index] = { ...steps[medSheet.index], medId };
    patch({ steps });
    setMedSheet(null);
  };

  const createMed = async () => {
    if (!newMed.name.trim()) return;
    const med: Medication = {
      id: newId(),
      name: newMed.name.trim(),
      kind: 'other',
      dose: newMed.dose.trim(),
      notes: '',
      color: MED_COLORS[data.meds.length % MED_COLORS.length],
    };
    await act(d => saveMed(d, med));
    setNewMed({ name: '', dose: '' });
    pickMed(med.id);
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const steps = [...draft.steps];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patch({ steps });
  };

  const summary =
    draft.steps.length > 0 && draft.times.length > 0
      ? `Στις ${sortTimes(draft.times).join(', ')}: ` +
        draft.steps
          .map((st, i) =>
            i === 0
              ? medOf(st.medId)?.name
              : `${st.waitMin > 0 ? `${formatMinutes(st.waitMin)} μετά` : 'αμέσως μετά'} ${medOf(st.medId)?.name}`,
          )
          .join(', ') +
        '.'
      : '';

  return (
    <Screen
      title={isNew ? 'Νέα ρουτίνα' : 'Ρουτίνα'}
      right={<IconButton icon="close" label="Κλείσιμο" onPress={() => router.back()} />}
    >
      <Card style={{ gap: 14 }}>
        <Field
          label="Όνομα"
          value={draft.name}
          onChangeText={name => patch({ name })}
          placeholder="π.χ. Μάτια πρωί-βράδυ"
        />
        <SwitchRow label="Ενεργή" value={draft.enabled} onChange={enabled => patch({ enabled })} />
      </Card>

      <SectionTitle>Ώρες</SectionTitle>
      <Card>
        <View style={s.wrap}>
          {sortTimes(draft.times).map(t => (
            <Chip
              key={t}
              label={t}
              selected
              onPress={() => setTimeSheet({ index: draft.times.indexOf(t), value: t })}
              onRemove={() => patch({ times: draft.times.filter(x => x !== t) })}
            />
          ))}
          <Chip label="+ Ώρα" onPress={() => setTimeSheet({ index: null, value: '09:00' })} />
        </View>
        <Text style={[s.label, { color: c.textSoft, marginTop: 6 }]}>Μέρες</Text>
        <View style={s.wrap}>
          <Chip label="Κάθε μέρα" selected={draft.days.length === 0} onPress={() => patch({ days: [] })} />
          {WEEK.map(d => (
            <Chip
              key={d}
              label={DAY_SHORT[d]}
              selected={draft.days.includes(d)}
              onPress={() => {
                const days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d];
                patch({ days: days.length === 7 ? [] : days });
              }}
            />
          ))}
        </View>
      </Card>

      <SectionTitle>Φάρμακα με τη σειρά</SectionTitle>
      {draft.steps.map((step, i) => {
        const med = medOf(step.medId);
        return (
          <View key={step.id} style={{ gap: 8 }}>
            {i > 0 && (
              <Card style={{ backgroundColor: c.cardAlt, gap: 8, paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="hourglass-outline" size={16} color={c.textSoft} />
                  <Text style={[s.label, { color: c.textSoft }]}>
                    Πόση ώρα μετά το {medOf(draft.steps[i - 1].medId)?.name ?? 'προηγούμενο'};
                  </Text>
                </View>
                <View style={s.wrap}>
                  {WAITS.map(w => (
                    <Chip
                      key={w}
                      label={w === 0 ? 'Αμέσως' : formatMinutes(w)}
                      selected={step.waitMin === w}
                      onPress={() => {
                        const steps = [...draft.steps];
                        steps[i] = { ...step, waitMin: w };
                        patch({ steps });
                      }}
                    />
                  ))}
                  {!WAITS.includes(step.waitMin) && <Chip label={formatMinutes(step.waitMin)} selected />}
                </View>
              </Card>
            )}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[st.num, { color: c.textMuted }]}>{i + 1}</Text>
              <Pressable style={st.medPick} onPress={() => setMedSheet({ index: i })}>
                <MedIcon kind={med?.kind} color={med?.color} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.medName, { color: c.text }]}>{med?.name ?? 'Διάλεξε φάρμακο'}</Text>
                  {!!med?.dose && (
                    <Text style={[s.hint, { color: c.textSoft }]} numberOfLines={1}>
                      {med.dose}
                    </Text>
                  )}
                </View>
              </Pressable>
              <View style={{ gap: 4 }}>
                {i > 0 && <IconButton icon="arrow-up" size={16} label="Πάνω" onPress={() => moveStep(i, -1)} />}
                {i < draft.steps.length - 1 && (
                  <IconButton icon="arrow-down" size={16} label="Κάτω" onPress={() => moveStep(i, 1)} />
                )}
              </View>
              <IconButton
                icon="trash-outline"
                size={18}
                label="Αφαίρεση"
                color={c.danger}
                onPress={() => patch({ steps: draft.steps.filter((_, j) => j !== i) })}
              />
            </Card>
          </View>
        );
      })}
      <Button label="Προσθήκη φαρμάκου" icon="add" onPress={() => setMedSheet({ index: null })} />

      {!!summary && (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
          <Text style={{ color: c.accentText, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{summary}</Text>
        </Card>
      )}

      <Button label="Αποθήκευση" kind="primary" icon="checkmark" onPress={save} />
      {!isNew && <Button label="Διαγραφή ρουτίνας" kind="danger" icon="trash-outline" onPress={remove} />}

      <Sheet
        visible={!!timeSheet}
        onClose={() => setTimeSheet(null)}
        title={timeSheet?.index == null ? 'Νέα ώρα' : 'Αλλαγή ώρας'}
      >
        {timeSheet && (
          <>
            <TimePicker value={timeSheet.value} onChange={value => setTimeSheet({ ...timeSheet, value })} />
            <Button
              label={`Εντάξει · ${timeSheet.value}`}
              kind="primary"
              icon="checkmark"
              onPress={() => {
                const times = [...draft.times];
                if (timeSheet.index == null) times.push(timeSheet.value);
                else times[timeSheet.index] = timeSheet.value;
                patch({ times: sortTimes(times) });
                setTimeSheet(null);
              }}
            />
          </>
        )}
      </Sheet>

      <Sheet visible={!!medSheet} onClose={() => setMedSheet(null)} title="Διάλεξε φάρμακο">
        {data.meds.map(m => (
          <Pressable
            key={m.id}
            onPress={() => pickMed(m.id)}
            style={({ pressed }) => [st.medRow, pressed && { opacity: 0.6 }]}
          >
            <MedIcon kind={m.kind} color={m.color} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[st.medName, { color: c.text }]}>{m.name}</Text>
              {!!m.dose && <Text style={[s.hint, { color: c.textSoft }]}>{m.dose}</Text>}
            </View>
          </Pressable>
        ))}
        <SectionTitle>Ή νέο φάρμακο</SectionTitle>
        <Field
          label="Όνομα"
          value={newMed.name}
          onChangeText={name => setNewMed({ ...newMed, name })}
          placeholder="π.χ. Exocin"
        />
        <Field
          label="Δόση"
          value={newMed.dose}
          onChangeText={dose => setNewMed({ ...newMed, dose })}
          placeholder="π.χ. 1 σταγόνα στο αριστερό μάτι"
        />
        <Button label="Προσθήκη" kind="primary" icon="add" onPress={createMed} disabled={!newMed.name.trim()} />
        <Text style={[s.hint, { color: c.textMuted }]}>
          Τα υπόλοιπα (είδος, χρώμα, διάρκεια) αλλάζουν από τη «Συνταγή».
        </Text>
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  num: { fontSize: 18, fontWeight: '800', width: 16, textAlign: 'center' },
  medPick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  medName: { fontSize: 17, fontWeight: '800' },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
