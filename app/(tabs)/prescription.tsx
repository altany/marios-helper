import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '../../src/i18n';
import { hhmmToMinutes, dateKey, daysBetween, formatDate, monthsShort, parseDateKey } from '../../src/lib/time';
import { upcomingAppointments } from '../../src/engine/physio';
import { firstPrescription } from '../../src/model/firstPrescription';
import { kindInfo } from '../../src/model/defaults';
import { AppData, Medication } from '../../src/model/types';
import { act } from '../../src/notify/commands';
import { useData } from '../../src/store/store';
import {
  Button,
  Card,
  Field,
  IconButton,
  Loading,
  MedIcon,
  s,
  Screen,
  SectionTitle,
  Sheet,
  useNow,
} from '../../src/ui/components';
import { apptWhen, PhysioIcon } from '../../src/ui/physio';
import { DatePicker } from '../../src/ui/pickers';
import { rounded, useColors } from '../../src/ui/theme';
import { toast } from '../../src/ui/toast';

const shortDate = (key: string) => {
  const d = parseDateKey(key);
  return `${d.getDate()} ${monthsShort()[d.getMonth()]}`;
};

/** "Έως 30 Οκτ · μένουν 19 μέρες", "Ολοκληρώθηκε 30 Οκτ", "Ξεκινά 1 Νοε" (until, finished, starts). */
export const periodText = (med: Medication, today: string): { text: string; ended: boolean } | null => {
  if (med.startDate && med.startDate > today) {
    return { text: t(`Ξεκινά ${shortDate(med.startDate)}`, `Starts ${shortDate(med.startDate)}`), ended: false };
  }
  if (med.endDate) {
    const left = daysBetween(today, med.endDate);
    if (left < 0) return { text: t(`Ολοκληρώθηκε ${shortDate(med.endDate)}`, `Finished ${shortDate(med.endDate)}`), ended: true };
    if (left === 0) return { text: t('Τελευταία μέρα σήμερα', 'Last day today'), ended: false };
    return {
      text: t(
        `Έως ${shortDate(med.endDate)} · μένουν ${left === 1 ? '1 μέρα' : `${left} μέρες`}`,
        `Until ${shortDate(med.endDate)} · ${left === 1 ? '1 day' : `${left} days`} left`,
      ),
      ended: false,
    };
  }
  return null;
};

const timesOf = (data: AppData, medId: string) =>
  Array.from(
    new Set(data.routines.filter(r => r.enabled && r.steps.some(st => st.medId === medId)).flatMap(r => r.times)),
  ).sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));

export default function PrescriptionScreen() {
  const c = useColors();
  const data = useData();
  const now = useNow(60_000);
  const [editVet, setEditVet] = useState(false);
  const [vet, setVet] = useState({ vetName: '', vetPhone: '', nextVisit: undefined as string | undefined });
  const [pickVisit, setPickVisit] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (data) setNotes(data.prescription.notes);
  }, [data?.prescription.notes]);

  if (!data) return <Loading />;
  const today = dateKey(now);
  const p = data.prescription;
  const active = data.meds.filter(m => !periodText(m, today)?.ended);
  const ended = data.meds.filter(m => periodText(m, today)?.ended);
  const visitIn = p.nextVisit ? daysBetween(today, p.nextVisit) : null;
  const first = firstPrescription();
  const nextVisit = upcomingAppointments(data, now)[0];

  const saveVet = async () => {
    await act(d => {
      d.prescription = { ...d.prescription, ...vet };
    });
    setEditVet(false);
    toast(t('Αποθηκεύτηκε', 'Saved'));
  };

  const medCard = (med: Medication) => {
    const period = periodText(med, today);
    const times = timesOf(data, med.id);
    return (
      <Card key={med.id} onPress={() => router.push(`/med/${med.id}`)} style={period?.ended && { opacity: 0.6 }}>
        <View style={st.medHead}>
          <MedIcon kind={med.kind} color={med.color} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[st.medName, { color: c.text }]}>{med.name}</Text>
            <Text style={[s.hint, { color: c.textSoft }]}>{kindInfo(med.kind).label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </View>
        {!!med.dose && <Text style={[st.dose, { color: c.text }]}>{med.dose}</Text>}
        {!!med.notes && <Text style={[s.hint, { color: c.textSoft, fontSize: 15 }]}>{med.notes}</Text>}
        <View style={st.metaRow}>
          {times.length > 0 && (
            <View style={st.meta}>
              <Ionicons name="time-outline" size={14} color={c.accentText} />
              <Text style={[st.metaText, { color: c.accentText }]}>{times.join(' · ')}</Text>
            </View>
          )}
          {period && (
            <View style={st.meta}>
              <Ionicons name="calendar-outline" size={14} color={period.ended ? c.textMuted : c.warn} />
              <Text style={[st.metaText, { color: period.ended ? c.textMuted : c.warn }]}>{period.text}</Text>
            </View>
          )}
          {times.length === 0 && !period?.ended && (
            <Text style={[st.metaText, { color: c.textMuted }]}>{t('Δεν είναι σε καμία ρουτίνα', 'Not in any routine')}</Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <Screen title={t('Συνταγή', 'Prescription')} subtitle={t('Τι είπε ο κτηνίατρος', 'What the vet said')}>
      <Card>
        <View style={st.medHead}>
          <View style={[st.vetIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="medkit" size={22} color={c.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.medName, { color: c.text }]}>{p.vetName || t('Κτηνίατρος', 'Vet')}</Text>
            {!!p.vetPhone && <Text style={[s.hint, { color: c.textSoft }]}>{p.vetPhone}</Text>}
          </View>
          {!!p.vetPhone && (
            <IconButton
              icon="call"
              label={t('Κλήση', 'Call')}
              color={c.accentText}
              onPress={() => Linking.openURL(`tel:${p.vetPhone.replace(/\s/g, '')}`)}
            />
          )}
          <IconButton
            icon="create-outline"
            label={t('Επεξεργασία', 'Edit')}
            onPress={() => {
              setVet({ vetName: p.vetName, vetPhone: p.vetPhone, nextVisit: p.nextVisit });
              setEditVet(true);
            }}
          />
        </View>
        {p.nextVisit ? (
          <View style={[st.visit, { backgroundColor: visitIn != null && visitIn >= 0 ? c.warnSoft : c.input }]}>
            <Ionicons name="calendar" size={16} color={c.warn} />
            <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>
              {t(`Επανέλεγχος: ${formatDate(p.nextVisit)}`, `Check-up: ${formatDate(p.nextVisit)}`)}
              {visitIn != null && visitIn > 0
                ? t(
                    ` · σε ${visitIn === 1 ? '1 μέρα' : `${visitIn} μέρες`}`,
                    ` · in ${visitIn === 1 ? '1 day' : `${visitIn} days`}`,
                  )
                : ''}
              {visitIn === 0 ? t(' · σήμερα', ' · today') : ''}
            </Text>
          </View>
        ) : (
          !p.vetName && (
            <Text style={[s.hint, { color: c.textMuted }]}>
              {t('Πρόσθεσε όνομα, τηλέφωνο και ημερομηνία επανελέγχου.', 'Add a name, a phone number and the check-up date.')}
            </Text>
          )
        )}
      </Card>

      <Card onPress={() => router.push('/physio')}>
        <View style={st.medHead}>
          <PhysioIcon />
          <View style={{ flex: 1 }}>
            <Text style={[st.medName, { color: c.text }]}>{t('Φυσικοθεραπεία', 'Physio')}</Text>
            <Text style={[s.hint, { color: c.textSoft }]}>
              {data.physio.daily
                ? t(`Ασκήσεις κάθε μέρα · υπενθύμιση ${data.physio.time}`, `Exercises every day · reminder ${data.physio.time}`)
                : t('Ασκήσεις κάθε μέρα και ραντεβού', 'Daily exercises and appointments')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </View>
        {nextVisit && (
          <View style={st.meta}>
            <Ionicons name="calendar-outline" size={14} color={c.warn} />
            <Text style={[st.metaText, { color: c.warn }]}>
              {t(`Επόμενο ραντεβού: ${apptWhen(nextVisit, today)}`, `Next appointment: ${apptWhen(nextVisit, today)}`)}
            </Text>
          </View>
        )}
      </Card>

      <SectionTitle>{t('Φάρμακα', 'Medicines')}</SectionTitle>
      {active.map(medCard)}
      <Button label={t('Νέο φάρμακο', 'New medicine')} kind="primary" icon="add" onPress={() => router.push('/med/new')} />

      <SectionTitle>{t('Σημειώσεις γιατρού', "Vet's notes")}</SectionTitle>
      <Card>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => notes !== p.notes && act(d => void (d.prescription.notes = notes))}
          multiline
          placeholder={t(
            'Ό,τι είπε ο γιατρός: διάγνωση, τι να προσέχεις, πότε να τον πάρεις τηλέφωνο…',
            'What the vet said: diagnosis, what to watch for, when to call…',
          )}
          placeholderTextColor={c.textMuted}
          style={[st.notes, { color: c.text }]}
        />
      </Card>

      {ended.length > 0 && (
        <>
          <SectionTitle>{t('Ολοκληρωμένα', 'Finished')}</SectionTitle>
          {ended.map(medCard)}
        </>
      )}

      <SectionTitle>{t('Αρχική συνταγή', 'First prescription')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={[st.period, { color: c.accentText }]}>{first.period}</Text>
        {first.meds.map((m, i) => (
          <View key={m.name} style={{ gap: 2 }}>
            <Text style={[st.firstName, { color: c.text }]}>
              {t(`Φάρμακο ${i + 1}: ${m.name}`, `Medicine ${i + 1}: ${m.name}`)}
            </Text>
            {m.lines.map(line => (
              <Text key={line} style={[s.hint, { color: c.textSoft, fontSize: 15, lineHeight: 21 }]}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </Card>

      <SectionTitle>{t('Χρήσιμα για τα μάτια', 'Eye care tips')}</SectionTitle>
      <Card style={{ backgroundColor: c.cardAlt }}>
        {t(
          [
            'Άφησε 5–10 λεπτά ανάμεσα σε διαφορετικές σταγόνες, για να μην ξεπλένει η μία την άλλη.',
            'Πρώτα οι σταγόνες, μετά η γέλη, στο τέλος η αλοιφή.',
            'Μην ακουμπάς την άκρη του μπουκαλιού στο μάτι.',
            'Αν ο γιατρός σου είπε κάτι άλλο, ισχύει αυτό.',
          ],
          [
            'Leave 5–10 minutes between different drops, so one doesn\'t wash out the other.',
            'Drops first, then gel, ointment last.',
            'Don\'t touch the eye with the tip of the bottle.',
            'If your vet told you something different, do that.',
          ],
        ).map(tip => (
          <View key={tip} style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="paw" size={14} color={c.accentText} style={{ marginTop: 3 }} />
            <Text style={[s.hint, { color: c.textSoft, flex: 1, fontSize: 15, lineHeight: 21 }]}>{tip}</Text>
          </View>
        ))}
      </Card>

      <Sheet visible={editVet} onClose={() => setEditVet(false)} title={t('Κτηνίατρος', 'Vet')}>
        <Field
          label={t('Όνομα', 'Name')}
          value={vet.vetName}
          onChangeText={vetName => setVet({ ...vet, vetName })}
          placeholder={t('π.χ. Δρ. Παπαδόπουλος', 'e.g. Dr Smith')}
        />
        <Field
          label={t('Τηλέφωνο', 'Phone')}
          value={vet.vetPhone}
          onChangeText={vetPhone => setVet({ ...vet, vetPhone })}
          keyboardType="phone-pad"
          placeholder="210 1234567"
        />
        <Text style={[s.label, { color: c.textSoft }]}>{t('Επανέλεγχος', 'Check-up')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            style={{ flex: 1 }}
            label={vet.nextVisit ? formatDate(vet.nextVisit) : t('Διάλεξε μέρα', 'Pick a day')}
            icon="calendar-outline"
            onPress={() => setPickVisit(true)}
          />
          {!!vet.nextVisit && (
            <IconButton
              icon="close"
              label={t('Χωρίς ημερομηνία', 'No date')}
              onPress={() => setVet({ ...vet, nextVisit: undefined })}
            />
          )}
        </View>
        {pickVisit && (
          <DatePicker
            value={vet.nextVisit}
            onChange={nextVisit => {
              setVet({ ...vet, nextVisit });
              setPickVisit(false);
            }}
          />
        )}
        <Button label={t('Αποθήκευση', 'Save')} kind="primary" icon="checkmark" onPress={saveVet} />
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  medHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medName: { ...rounded, fontSize: 19, lineHeight: 25 },
  dose: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, fontWeight: '700' },
  vetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  notes: { fontSize: 16, lineHeight: 23, minHeight: 90, textAlignVertical: 'top' },
  period: { fontSize: 14, fontWeight: '800' },
  firstName: { fontSize: 16, fontWeight: '800' },
});
