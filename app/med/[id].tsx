import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteMed, saveMed } from '../../src/engine/actions';
import { t } from '../../src/i18n';
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
      Alert.alert(t('Λείπει όνομα', 'No name'), t('Γράψε το όνομα του φαρμάκου.', 'Write the name of the medicine.'));
      return false;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      Alert.alert(t('Ημερομηνίες', 'Dates'), t('Η λήξη είναι πριν από την έναρξη.', 'The end date is before the start date.'));
      return false;
    }
    await act(d =>
      saveMed(d, { ...draft, name: draft.name.trim(), dose: draft.dose.trim(), notes: draft.notes.trim() }),
    );
    return true;
  };

  const save = async () => {
    if (!(await persist())) return;
    toast(t('Αποθηκεύτηκε', 'Saved'));
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
      t('Διαγραφή', 'Delete'),
      usedIn.length
        ? t(
            `Το ${draft.name} θα βγει και από ${usedIn.length === 1 ? 'τη ρουτίνα' : 'τις ρουτίνες'}: ${usedIn.map(r => r.name).join(', ')}.`,
            `${draft.name} will also be taken out of ${usedIn.length === 1 ? 'the routine' : 'the routines'}: ${usedIn.map(r => r.name).join(', ')}.`,
          )
        : t(`Να διαγραφεί το ${draft.name};`, `Delete ${draft.name}?`),
      [
        { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
        {
          text: t('Διαγραφή', 'Delete'),
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
      title={isNew ? t('Νέο φάρμακο', 'New medicine') : draft.name || t('Φάρμακο', 'Medicine')}
      right={<IconButton icon="close" label={t('Κλείσιμο', 'Close')} onPress={() => router.back()} />}
    >
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <MedIcon kind={draft.kind} color={draft.color} size={52} />
          <View style={{ flex: 1 }}>
            <Field
              label={t('Όνομα', 'Name')}
              value={draft.name}
              onChangeText={name => patch({ name })}
              placeholder={t('π.χ. Κολλύριο', 'e.g. Eye drops')}
            />
          </View>
        </View>
        <Field
          label={t('Δόση', 'Dose')}
          value={draft.dose}
          onChangeText={dose => patch({ dose })}
          placeholder={t('π.χ. 1 σταγόνα σε κάθε μάτι', 'e.g. 1 drop in each eye')}
          hint={t('Φαίνεται μέσα στην ειδοποίηση.', 'Shown in the reminder.')}
          multiline
        />
        <Field
          label={t('Οδηγίες', 'Instructions')}
          value={draft.notes}
          onChangeText={notes => patch({ notes })}
          placeholder={t('π.χ. μασάζ στο βλέφαρο, φύλαξη στο ψυγείο', 'e.g. massage the eyelid, keep in the fridge')}
          multiline
        />
      </Card>

      <SectionTitle>{t('Πότε δίνεται', 'When it is given')}</SectionTitle>
      {usedIn.map(r => (
        <Card
          key={r.id}
          onPress={() => router.push(`/routine/${r.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={[st.routineName, { color: c.text }]}>
              {r.name || t('Ρουτίνα', 'Routine')}
              {r.enabled ? '' : t(' (ανενεργή)', ' (off)')}
            </Text>
            <View style={s.wrap}>
              {r.times.map(time => (
                <View key={time} style={[st.time, { backgroundColor: c.accentSoft }]}>
                  <Text style={[st.timeText, { color: c.accentText }]}>{time}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={{ color: c.accentText, fontWeight: '700' }}>{t('Αλλαγή ωρών', 'Change times')}</Text>
          <Ionicons name="chevron-forward" size={18} color={c.accentText} />
        </Card>
      ))}
      {usedIn.length === 0 && (
        <Card>
          <Text style={[s.hint, { color: c.textSoft }]}>
            {t(
              'Δεν είναι ακόμα στο πρόγραμμα, οπότε δεν έρχονται ειδοποιήσεις για αυτό.',
              "It isn't in the schedule yet, so no reminders come for it.",
            )}
          </Text>
          <Button
            label={t("Βάλ' το στο πρόγραμμα", 'Add it to the schedule')}
            kind="primary"
            icon="time-outline"
            onPress={addToSchedule}
          />
        </Card>
      )}

      <SectionTitle>{t('Είδος', 'Type')}</SectionTitle>
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
              accessibilityLabel={t('Χρώμα', 'Colour')}
              style={[
                st.swatch,
                { backgroundColor: col },
                draft.color === col && { borderColor: c.text, borderWidth: 3 },
              ]}
            />
          ))}
        </View>
      </Card>

      <SectionTitle>{t('Διάρκεια θεραπείας', 'Treatment dates')}</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {dateButton('startDate', t('Από', 'From'), t('Από τώρα', 'From now'))}
          {dateButton('endDate', t('Έως', 'Until'), t('Χωρίς τέλος', 'No end'))}
        </View>
        <View style={s.wrap}>
          {[7, 10, 14, 30].map(n => (
            <Chip
              key={n}
              label={t(`${n} μέρες`, `${n} days`)}
              onPress={() =>
                patch({ endDate: addDays(draft.startDate && draft.startDate > today ? draft.startDate : today, n - 1) })
              }
            />
          ))}
        </View>
        <Text style={[s.hint, { color: c.textMuted }]}>
          {t(
            'Μετά τη λήξη δεν έρχονται άλλες ειδοποιήσεις για αυτό το φάρμακο.',
            'After the end date, no more reminders come for this medicine.',
          )}
        </Text>
      </Card>

      <Button label={t('Αποθήκευση', 'Save')} kind="primary" icon="checkmark" onPress={save} />
      {!isNew && (
        <Button label={t('Διαγραφή φαρμάκου', 'Delete medicine')} kind="danger" icon="trash-outline" onPress={remove} />
      )}

      <Sheet
        visible={!!dateSheet}
        onClose={() => setDateSheet(null)}
        title={dateSheet === 'startDate' ? t('Έναρξη', 'Start') : t('Λήξη', 'End')}
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
              label={
                dateSheet === 'startDate'
                  ? t('Χωρίς ημερομηνία έναρξης', 'No start date')
                  : t('Χωρίς ημερομηνία λήξης', 'No end date')
              }
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
