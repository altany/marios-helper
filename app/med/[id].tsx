import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteMed, saveMed } from '../../src/engine/actions';
import { newId } from '../../src/lib/id';
import { addDays, dateKey, formatDate } from '../../src/lib/time';
import { MED_COLORS, MED_KINDS } from '../../src/model/defaults';
import { Medication } from '../../src/model/types';
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
} from '../../src/ui/components';
import { DatePicker } from '../../src/ui/pickers';
import { useColors } from '../../src/ui/theme';
import { toast } from '../../src/ui/toast';

export default function MedEditor() {
  const c = useColors();
  const data = useData();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Medication | null>(null);
  const [dateSheet, setDateSheet] = useState<'startDate' | 'endDate' | null>(null);

  useEffect(() => {
    if (!data || draft) return;
    const existing = data.meds.find(m => m.id === id);
    setDraft(
      existing
        ? { ...existing }
        : {
            id: newId(),
            name: '',
            kind: 'drops',
            dose: '',
            notes: '',
            color: MED_COLORS[data.meds.length % MED_COLORS.length],
          },
    );
  }, [data, id, draft]);

  if (!data || !draft) return <Loading />;
  const patch = (p: Partial<Medication>) => setDraft({ ...draft, ...p });
  const usedIn = data.routines.filter(r => r.steps.some(st => st.medId === draft.id));
  const today = dateKey(Date.now());

  /** Saves the medicine; false if something is missing. */
  const persist = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Λείπει όνομα', 'Γράψε το όνομα του φαρμάκου.');
      return false;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      Alert.alert('Ημερομηνίες', 'Η λήξη είναι πριν από την έναρξη.');
      return false;
    }
    await act(d =>
      saveMed(d, { ...draft, name: draft.name.trim(), dose: draft.dose.trim(), notes: draft.notes.trim() }),
    );
    return true;
  };

  const save = async () => {
    if (!(await persist())) return;
    toast('Αποθηκεύτηκε');
    router.back();
  };

  /** Opens a new routine with this medicine, to choose its times. */
  const addToSchedule = async () => {
    if (isNew) {
      if (!(await persist())) return;
      router.replace(`/routine/new?med=${draft.id}`);
    } else {
      router.push(`/routine/new?med=${draft.id}`);
    }
  };

  const remove = () =>
    Alert.alert(
      'Διαγραφή',
      usedIn.length
        ? `Το ${draft.name} θα βγει και από ${usedIn.length === 1 ? 'τη ρουτίνα' : 'τις ρουτίνες'}: ${usedIn.map(r => r.name).join(', ')}.`
        : `Να διαγραφεί το ${draft.name};`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            await act(d => deleteMed(d, draft.id));
            router.back();
          },
        },
      ],
    );

  const dateButton = (key: 'startDate' | 'endDate', label: string, empty: string) => (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={[s.label, { color: c.textSoft }]}>{label}</Text>
      <Button
        small
        label={draft[key] ? formatDate(draft[key]!, false) : empty}
        icon="calendar-outline"
        onPress={() => setDateSheet(key)}
      />
    </View>
  );

  return (
    <Screen
      title={isNew ? 'Νέο φάρμακο' : draft.name || 'Φάρμακο'}
      right={<IconButton icon="close" label="Κλείσιμο" onPress={() => router.back()} />}
    >
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <MedIcon kind={draft.kind} color={draft.color} size={52} />
          <View style={{ flex: 1 }}>
            <Field label="Όνομα" value={draft.name} onChangeText={name => patch({ name })} placeholder="π.χ. Hylogel" />
          </View>
        </View>
        <Field
          label="Δόση"
          value={draft.dose}
          onChangeText={dose => patch({ dose })}
          placeholder="π.χ. 1 σταγόνα σε κάθε μάτι"
          hint="Φαίνεται μέσα στην ειδοποίηση."
          multiline
        />
        <Field
          label="Οδηγίες"
          value={draft.notes}
          onChangeText={notes => patch({ notes })}
          placeholder="π.χ. μασάζ στο βλέφαρο, φύλαξη στο ψυγείο"
          multiline
        />
      </Card>

      <SectionTitle>Πότε δίνεται</SectionTitle>
      {usedIn.map(r => (
        <Card
          key={r.id}
          onPress={() => router.push(`/routine/${r.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={[st.routineName, { color: c.text }]}>
              {r.name || 'Ρουτίνα'}
              {r.enabled ? '' : ' (ανενεργή)'}
            </Text>
            <View style={s.wrap}>
              {r.times.map(t => (
                <View key={t} style={[st.time, { backgroundColor: c.accentSoft }]}>
                  <Text style={[st.timeText, { color: c.accentText }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={{ color: c.accentText, fontWeight: '700' }}>Αλλαγή ωρών</Text>
          <Ionicons name="chevron-forward" size={18} color={c.accentText} />
        </Card>
      ))}
      {usedIn.length === 0 && (
        <Card>
          <Text style={[s.hint, { color: c.textSoft }]}>
            Δεν είναι ακόμα στο πρόγραμμα, οπότε δεν έρχονται ειδοποιήσεις για αυτό.
          </Text>
          <Button label="Βάλ' το στο πρόγραμμα" kind="primary" icon="time-outline" onPress={addToSchedule} />
        </Card>
      )}

      <SectionTitle>Είδος</SectionTitle>
      <Card>
        <View style={s.wrap}>
          {MED_KINDS.map(k => (
            <Chip
              key={k.kind}
              label={k.label}
              selected={draft.kind === k.kind}
              onPress={() => patch({ kind: k.kind })}
            />
          ))}
        </View>
        <View style={[s.wrap, { marginTop: 6 }]}>
          {MED_COLORS.map(col => (
            <Pressable
              key={col}
              onPress={() => patch({ color: col })}
              accessibilityLabel="Χρώμα"
              style={[
                st.swatch,
                { backgroundColor: col },
                draft.color === col && { borderColor: c.text, borderWidth: 3 },
              ]}
            />
          ))}
        </View>
      </Card>

      <SectionTitle>Διάρκεια θεραπείας</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {dateButton('startDate', 'Από', 'Από τώρα')}
          {dateButton('endDate', 'Έως', 'Χωρίς τέλος')}
        </View>
        <View style={s.wrap}>
          {[7, 10, 14, 30].map(n => (
            <Chip
              key={n}
              label={`${n} μέρες`}
              onPress={() =>
                patch({ endDate: addDays(draft.startDate && draft.startDate > today ? draft.startDate : today, n - 1) })
              }
            />
          ))}
        </View>
        <Text style={[s.hint, { color: c.textMuted }]}>
          Μετά τη λήξη δεν έρχονται άλλες ειδοποιήσεις για αυτό το φάρμακο.
        </Text>
      </Card>

      <Button label="Αποθήκευση" kind="primary" icon="checkmark" onPress={save} />
      {!isNew && <Button label="Διαγραφή φαρμάκου" kind="danger" icon="trash-outline" onPress={remove} />}

      <Sheet
        visible={!!dateSheet}
        onClose={() => setDateSheet(null)}
        title={dateSheet === 'startDate' ? 'Έναρξη' : 'Λήξη'}
      >
        {dateSheet && (
          <>
            <DatePicker
              value={draft[dateSheet]}
              onChange={v => {
                patch({ [dateSheet]: v });
                setDateSheet(null);
              }}
            />
            <Button
              label={dateSheet === 'startDate' ? 'Χωρίς ημερομηνία έναρξης' : 'Χωρίς ημερομηνία λήξης'}
              kind="ghost"
              onPress={() => {
                patch({ [dateSheet]: undefined });
                setDateSheet(null);
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 0 },
  routineName: { fontSize: 17, fontWeight: '800' },
  time: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  timeText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
