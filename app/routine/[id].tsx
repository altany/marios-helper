import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteRoutine, saveMed, saveRoutine } from '../../src/engine/actions';
import { t } from '../../src/i18n';
import { newId } from '../../src/lib/id';
import { dayShort, everyHours, formatMinutes, sortTimes } from '../../src/lib/time';
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
const EVERY = [4, 6, 8, 12];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function RoutineEditor() {
  const c = useColors();
  const data = useData();
  // `med`: start a new routine with this medicine (from the medicine screen).
  const { id, med: startMed } = useLocalSearchParams<{ id: string; med?: string }>();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Routine | null>(null);
  const [timeSheet, setTimeSheet] = useState<{ index: number | null; value: string } | null>(null);
  const [everySheet, setEverySheet] = useState<{ first: string; hours: number } | null>(null);
  const [medSheet, setMedSheet] = useState<{ index: number | null } | null>(null);
  const [newMed, setNewMed] = useState({ name: '', dose: '' });

  useEffect(() => {
    if (!data || draft) return;
    const existing = data.routines.find(r => r.id === id);
    const med = data.meds.find(m => m.id === startMed);
    setDraft(
      existing
        ? JSON.parse(JSON.stringify(existing))
        : {
            id: newId(),
            name: med?.name ?? '',
            times: [],
            days: [],
            steps: med ? [{ id: newId(), medId: med.id, waitMin: 0 }] : [],
            enabled: true,
            createdAt: Date.now(),
            fromGiven: false,
          },
    );
  }, [data, id, draft, startMed]);

  if (!data || !draft) return <Loading />;
  const patch = (p: Partial<Routine>) => setDraft({ ...draft, ...p });
  const medOf = (medId: string) => data.meds.find(m => m.id === medId);

  const save = async () => {
    if (draft.steps.length === 0)
      return Alert.alert(t('Λείπει φάρμακο', 'No medicine'), t('Πρόσθεσε τουλάχιστον ένα φάρμακο.', 'Add at least one medicine.'));
    if (draft.times.length === 0)
      return Alert.alert(t('Λείπει ώρα', 'No time'), t('Πρόσθεσε τουλάχιστον μία ώρα.', 'Add at least one time.'));
    await act(d =>
      saveRoutine(d, {
        ...draft,
        name: draft.name.trim(),
        times: sortTimes(draft.times),
        fromGiven: draft.times.length > 1 && !!draft.fromGiven,
      }),
    );
    toast(t('Αποθηκεύτηκε', 'Saved'));
    router.back();
  };

  const remove = () =>
    Alert.alert(
      t('Διαγραφή', 'Delete'),
      t(
        `Να διαγραφεί η ρουτίνα «${draft.name || 'Ρουτίνα'}»; Το ιστορικό μένει.`,
        `Delete the routine "${draft.name || 'Routine'}"? The history stays.`,
      ),
      [
        { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
        {
          text: t('Διαγραφή', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await act(d => deleteRoutine(d, draft.id));
            router.back();
          },
        },
      ],
    );

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
      ? t(`Στις ${sortTimes(draft.times).join(', ')}: `, `At ${sortTimes(draft.times).join(', ')}: `) +
        draft.steps
          .map((st, i) =>
            i === 0
              ? medOf(st.medId)?.name
              : st.waitMin > 0
                ? t(`${formatMinutes(st.waitMin)} μετά ${medOf(st.medId)?.name}`, `${medOf(st.medId)?.name} ${formatMinutes(st.waitMin)} later`)
                : t(`αμέσως μετά ${medOf(st.medId)?.name}`, `${medOf(st.medId)?.name} straight after`),
          )
          .join(', ') +
        '.'
      : '';

  return (
    <Screen
      title={isNew ? t('Νέα ρουτίνα', 'New routine') : t('Ρουτίνα', 'Routine')}
      right={<IconButton icon="close" label={t('Κλείσιμο', 'Close')} onPress={() => router.back()} />}
    >
      <Card style={{ gap: 14 }}>
        <Field
          label={t('Όνομα', 'Name')}
          value={draft.name}
          onChangeText={name => patch({ name })}
          placeholder={t('π.χ. Μάτια πρωί-βράδυ', 'e.g. Eyes morning and evening')}
        />
        <SwitchRow label={t('Ενεργή', 'On')} value={draft.enabled} onChange={enabled => patch({ enabled })} />
      </Card>

      <SectionTitle>{t('Ώρες', 'Times')}</SectionTitle>
      <Card>
        <View style={s.wrap}>
          {sortTimes(draft.times).map(time => (
            <Chip
              key={time}
              label={time}
              selected
              onPress={() => setTimeSheet({ index: draft.times.indexOf(time), value: time })}
              onRemove={() => patch({ times: draft.times.filter(x => x !== time) })}
            />
          ))}
          <Chip label={t('+ Ώρα', '+ Time')} onPress={() => setTimeSheet({ index: null, value: '09:00' })} />
          <Chip
            label={t('Κάθε … ώρες', 'Every … hours')}
            onPress={() => setEverySheet({ first: sortTimes(draft.times)[0] ?? '08:00', hours: 8 })}
          />
        </View>
        <Text style={[s.label, { color: c.textSoft, marginTop: 6 }]}>{t('Μέρες', 'Days')}</Text>
        <View style={s.wrap}>
          <Chip label={t('Κάθε μέρα', 'Every day')} selected={draft.days.length === 0} onPress={() => patch({ days: [] })} />
          {WEEK.map(d => (
            <Chip
              key={d}
              label={dayShort()[d]}
              selected={draft.days.includes(d)}
              onPress={() => {
                const days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d];
                patch({ days: days.length === 7 ? [] : days });
              }}
            />
          ))}
        </View>
        {draft.times.length > 1 && (
          <SwitchRow
            label={t('Μετράει από την προηγούμενη δόση', 'Timed from the previous dose')}
            hint={t(
              'Π.χ. 07:00 και 15:00: αν δώσεις την πρώτη στις 08:20, η επόμενη έρχεται 16:20. Η πρώτη δόση κάθε μέρας μένει στην ώρα της.',
              'E.g. 07:00 and 15:00: if you give the first at 08:20, the next one comes at 16:20. The first dose of each day stays at its time.',
            )}
            value={!!draft.fromGiven}
            onChange={fromGiven => patch({ fromGiven })}
          />
        )}
      </Card>

      <SectionTitle>{t('Φάρμακα με τη σειρά', 'Medicines, in order')}</SectionTitle>
      {draft.steps.map((step, i) => {
        const med = medOf(step.medId);
        return (
          <View key={step.id} style={{ gap: 8 }}>
            {i > 0 && (
              <Card style={{ backgroundColor: c.cardAlt, gap: 8, paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="hourglass-outline" size={16} color={c.textSoft} />
                  <Text style={[s.label, { color: c.textSoft }]}>
                    {t(
                      `Πόση ώρα μετά το ${medOf(draft.steps[i - 1].medId)?.name ?? 'προηγούμενο'};`,
                      `How long after ${medOf(draft.steps[i - 1].medId)?.name ?? 'the previous one'}?`,
                    )}
                  </Text>
                </View>
                <View style={s.wrap}>
                  {WAITS.map(w => (
                    <Chip
                      key={w}
                      label={w === 0 ? t('Αμέσως', 'Straight away') : formatMinutes(w)}
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
                  <Text style={[st.medName, { color: c.text }]}>{med?.name ?? t('Διάλεξε φάρμακο', 'Pick a medicine')}</Text>
                  {!!med?.dose && (
                    <Text style={[s.hint, { color: c.textSoft }]} numberOfLines={1}>
                      {med.dose}
                    </Text>
                  )}
                </View>
              </Pressable>
              <View style={{ gap: 4 }}>
                {i > 0 && <IconButton icon="arrow-up" size={16} label={t('Πάνω', 'Up')} onPress={() => moveStep(i, -1)} />}
                {i < draft.steps.length - 1 && (
                  <IconButton icon="arrow-down" size={16} label={t('Κάτω', 'Down')} onPress={() => moveStep(i, 1)} />
                )}
              </View>
              <IconButton
                icon="trash-outline"
                size={18}
                label={t('Αφαίρεση', 'Remove')}
                color={c.danger}
                onPress={() => patch({ steps: draft.steps.filter((_, j) => j !== i) })}
              />
            </Card>
          </View>
        );
      })}
      <Button label={t('Προσθήκη φαρμάκου', 'Add a medicine')} icon="add" onPress={() => setMedSheet({ index: null })} />

      {!!summary && (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
          <Text style={{ color: c.accentText, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{summary}</Text>
        </Card>
      )}

      <Button label={t('Αποθήκευση', 'Save')} kind="primary" icon="checkmark" onPress={save} />
      {!isNew && (
        <Button label={t('Διαγραφή ρουτίνας', 'Delete routine')} kind="danger" icon="trash-outline" onPress={remove} />
      )}

      <Sheet
        visible={!!timeSheet}
        onClose={() => setTimeSheet(null)}
        title={timeSheet?.index == null ? t('Νέα ώρα', 'New time') : t('Αλλαγή ώρας', 'Change time')}
      >
        {timeSheet && (
          <>
            <TimePicker value={timeSheet.value} onChange={value => setTimeSheet({ ...timeSheet, value })} />
            <Button
              label={t(`Εντάξει · ${timeSheet.value}`, `OK · ${timeSheet.value}`)}
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

      <Sheet visible={!!everySheet} onClose={() => setEverySheet(null)} title={t('Κάθε Χ ώρες', 'Every X hours')}>
        {everySheet && (
          <>
            <View style={s.wrap}>
              {EVERY.map(h => (
                <Chip
                  key={h}
                  label={t(`Κάθε ${h} ώρες`, `Every ${h} hours`)}
                  selected={everySheet.hours === h}
                  onPress={() => setEverySheet({ ...everySheet, hours: h })}
                />
              ))}
            </View>
            <Text style={[s.label, { color: c.textSoft }]}>{t('Πρώτη δόση της μέρας', 'First dose of the day')}</Text>
            <TimePicker value={everySheet.first} onChange={first => setEverySheet({ ...everySheet, first })} />
            <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
              <Text style={{ color: c.accentText, fontSize: 16, fontWeight: '700' }}>
                {everyHours(everySheet.first, everySheet.hours).join(' · ')}
              </Text>
            </Card>
            <Button
              label={t('Εντάξει', 'OK')}
              kind="primary"
              icon="checkmark"
              onPress={() => {
                patch({ times: everyHours(everySheet.first, everySheet.hours), fromGiven: true });
                setEverySheet(null);
              }}
            />
            <Text style={[s.hint, { color: c.textMuted }]}>
              {t(
                'Αντικαθιστά τις ώρες που υπάρχουν ήδη στη ρουτίνα. Κάθε δόση μετράει από την ώρα που έδωσες την προηγούμενη.',
                'Replaces the times already in the routine. Each dose is timed from when you gave the previous one.',
              )}
            </Text>
          </>
        )}
      </Sheet>

      <Sheet visible={!!medSheet} onClose={() => setMedSheet(null)} title={t('Διάλεξε φάρμακο', 'Pick a medicine')}>
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
        <SectionTitle>{t('Ή νέο φάρμακο', 'Or a new medicine')}</SectionTitle>
        <Field
          label={t('Όνομα', 'Name')}
          value={newMed.name}
          onChangeText={name => setNewMed({ ...newMed, name })}
          placeholder={t('π.χ. Κολλύριο', 'e.g. Eye drops')}
        />
        <Field
          label={t('Δόση', 'Dose')}
          value={newMed.dose}
          onChangeText={dose => setNewMed({ ...newMed, dose })}
          placeholder={t('π.χ. 1 σταγόνα στο αριστερό μάτι', 'e.g. 1 drop in the left eye')}
        />
        <Button
          label={t('Προσθήκη', 'Add')}
          kind="primary"
          icon="add"
          onPress={createMed}
          disabled={!newMed.name.trim()}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          {t(
            'Τα υπόλοιπα (είδος, χρώμα, διάρκεια) αλλάζουν από τη «Συνταγή».',
            'The rest (type, colour, dates) can be changed in Prescription.',
          )}
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
