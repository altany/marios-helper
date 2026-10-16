import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  APPT_REMIND_MIN,
  deleteAppointment,
  markPhysio,
  pastAppointments,
  physioDay,
  PhysioStatus,
  physioStreak,
  saveAppointment,
  setPhysioDaily,
  setPhysioTime,
  unmarkPhysio,
  upcomingAppointments,
} from '../src/engine/physio';
import { t } from '../src/i18n';
import { newId } from '../src/lib/id';
import {
  addDays,
  atTime,
  dateKey,
  dayShort,
  daysBetween,
  formatDate,
  formatMinutesWords,
  parseDateKey,
  toHHMM,
} from '../src/lib/time';
import { Appointment } from '../src/model/types';
import { act } from '../src/notify/commands';
import { useData } from '../src/store/store';
import {
  Button,
  Card,
  Field,
  IconButton,
  Loading,
  s,
  Screen,
  SectionTitle,
  Sheet,
  SwitchRow,
  useNow,
} from '../src/ui/components';
import { apptWhen, PhysioActions, PhysioIcon, physioStatusText } from '../src/ui/physio';
import { DatePicker, TimePicker } from '../src/ui/pickers';
import { Colors, rounded, useColors } from '../src/ui/theme';
import { toast } from '../src/ui/toast';

const WEEKS = 4;

type Draft = { id: string; date: string; time: string; note: string; isNew: boolean };

const pawColor = (status: PhysioStatus, c: Colors) =>
  ({ done: c.accent, missed: c.danger, due: c.warn, upcoming: c.textMuted, off: c.textMuted })[status];

export default function PhysioScreen() {
  const c = useColors();
  const data = useData();
  const now = useNow(60_000);
  const [timeOpen, setTimeOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<'date' | 'time'>('date');
  if (!data) return <Loading />;

  const today = dateKey(now);
  const p = data.physio;
  const day = physioDay(data, today, now);
  const status = physioStatusText(day);
  const streak = physioStreak(data, now);
  const upcoming = upcomingAppointments(data, now);
  const past = pastAppointments(data, now);

  // The last 4 weeks, Monday to Sunday, ending with this week.
  const sunday = addDays(today, (7 - parseDateKey(today).getDay()) % 7);
  const first = addDays(sunday, -(WEEKS * 7 - 1));
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(first, i));
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter(d => p.done[d]).length;

  const statusColor = day.status === 'done' ? c.success : day.status === 'due' ? c.warn : c.textSoft;

  const toggle = (date: string) =>
    act(d => (d.physio.done[date] ? unmarkPhysio(d, date) : markPhysio(d, date, Date.now())));

  const openNew = () => {
    const latest = [...p.appointments].sort((a, b) => b.at - a.at)[0];
    setDraft({
      id: newId(),
      date: addDays(today, 1),
      time: latest ? toHHMM(latest.at) : '10:00',
      note: '',
      isNew: true,
    });
    setPick('date');
  };
  const openEdit = (a: Appointment) => {
    setDraft({ id: a.id, date: dateKey(a.at), time: toHHMM(a.at), note: a.note, isNew: false });
    setPick('date');
  };
  const saveDraft = async () => {
    if (!draft) return;
    const appt = { id: draft.id, at: atTime(draft.date, draft.time), note: draft.note.trim() };
    await act(d => saveAppointment(d, appt));
    toast(t('Το ραντεβού αποθηκεύτηκε', 'Appointment saved'));
    setDraft(null);
  };
  const removeDraft = () => {
    if (!draft) return;
    Alert.alert(
      t('Διαγραφή ραντεβού', 'Delete appointment'),
      t('Να σβηστεί αυτό το ραντεβού;', 'Delete this appointment?'),
      [
        { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
        {
          text: t('Διαγραφή', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await act(d => deleteAppointment(d, draft.id));
            setDraft(null);
          },
        },
      ],
    );
  };

  return (
    <Screen
      title={t('Φυσικοθεραπεία', 'Physio')}
      subtitle={t('Ασκήσεις κάθε μέρα και ραντεβού', 'Daily exercises and appointments')}
      right={<IconButton icon="close" label={t('Κλείσιμο', 'Close')} onPress={() => router.back()} />}
    >
      <Card>
        <SwitchRow
          label={t('Ασκήσεις κάθε μέρα', 'Exercises every day')}
          hint={t(
            'Φαίνονται στο «Σήμερα». Αν δεν πατήσεις «Έγινε» ως την ώρα της υπενθύμισης, θα έρθει ειδοποίηση.',
            'They show on "Today". If you haven\'t tapped "Done" by the reminder time, a reminder comes.',
          )}
          value={p.daily}
          onChange={daily => act(d => setPhysioDaily(d, daily, dateKey(Date.now())))}
        />
        {p.daily && (
          <View style={st.timeRow}>
            <Text style={[st.rowLabel, { color: c.text }]}>{t('Υπενθύμιση', 'Reminder')}</Text>
            <Button small label={p.time} icon="alarm-outline" onPress={() => setTimeOpen(p.time)} />
          </View>
        )}
      </Card>

      {p.daily && (
        <Card>
          <View style={st.head}>
            <PhysioIcon />
            <View style={{ flex: 1 }}>
              <Text style={[st.title, { color: c.text }]}>{t('Σήμερα', 'Today')}</Text>
              {!!status && (
                <Text style={[st.status, { color: statusColor }]}>{status}</Text>
              )}
            </View>
          </View>
          <PhysioActions day={day} today={today} />
        </Card>
      )}

      {(p.daily || Object.keys(p.done).length > 0) && (
        <>
          <SectionTitle>{t('Τελευταίες 4 εβδομάδες', 'Last 4 weeks')}</SectionTitle>
          <Card>
            <View style={st.stats}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[st.big, { color: c.text }]}>{streak}</Text>
                <Text style={[s.hint, { color: c.textSoft }]}>{t('μέρες στη σειρά', 'days in a row')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[st.big, { color: c.text }]}>{last7}/7</Text>
                <Text style={[s.hint, { color: c.textSoft }]}>{t('τις τελευταίες 7 μέρες', 'in the last 7 days')}</Text>
              </View>
            </View>
            <View style={st.week}>
              {[1, 2, 3, 4, 5, 6, 0].map(d => (
                <Text key={d} style={[st.weekDay, { color: c.textMuted }]}>
                  {dayShort()[d]}
                </Text>
              ))}
            </View>
            <View style={st.week}>
              {days.map(date => {
                const v = physioDay(data, date, now);
                const future = date > today;
                return (
                  <Pressable
                    key={date}
                    disabled={future}
                    onPress={() => toggle(date)}
                    accessibilityLabel={`${formatDate(date)}: ${physioStatusText(v) ?? ''}`}
                    style={({ pressed }) => [
                      st.cell,
                      date === today && { borderColor: c.accent, borderWidth: 1.5 },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons
                      name={v.status === 'done' ? 'paw' : 'paw-outline'}
                      size={22}
                      color={pawColor(v.status, c)}
                      style={{ opacity: future || v.status === 'off' ? 0.35 : 1 }}
                    />
                    <Text style={[st.cellDay, { color: future ? c.textMuted : c.textSoft }]}>
                      {parseDateKey(date).getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>
              {t(
                'Γεμάτο πατουσάκι: έγινε · Κόκκινο: δεν σημειώθηκε. Πάτα μια μέρα για να τη σημειώσεις ή να το αναιρέσεις.',
                'Filled paw: done · Red: not marked. Tap a day to mark it, or to undo.',
              )}
            </Text>
          </Card>
        </>
      )}

      <SectionTitle>{t('Ραντεβού', 'Appointments')}</SectionTitle>
      {upcoming.length === 0 && (
        <Text style={[s.hint, { color: c.textSoft, paddingHorizontal: 4 }]}>
          {t('Κανένα ραντεβού ακόμα.', 'No appointments yet.')}
        </Text>
      )}
      {upcoming.map(a => {
        const inDays = daysBetween(today, dateKey(a.at));
        return (
          <Card key={a.id} onPress={() => openEdit(a)} style={inDays === 0 && { borderColor: c.warn, borderWidth: 2 }}>
            <View style={st.head}>
              <View style={[st.dateBox, { backgroundColor: inDays === 0 ? c.warnSoft : c.accentSoft }]}>
                <Text style={[st.dateNum, { color: inDays === 0 ? c.warn : c.accentText }]}>
                  {parseDateKey(dateKey(a.at)).getDate()}
                </Text>
                <Text style={[st.dateWeekday, { color: inDays === 0 ? c.warn : c.accentText }]}>
                  {dayShort()[parseDateKey(dateKey(a.at)).getDay()]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.apptTitle, { color: c.text }]}>{apptWhen(a, today).replace(/^./, ch => ch.toUpperCase())}</Text>
                {inDays > 1 && (
                  <Text style={[s.hint, { color: c.accentText, fontWeight: '700' }]}>
                    {t(`σε ${inDays} μέρες`, `in ${inDays} days`)}
                  </Text>
                )}
                {!!a.note && <Text style={[s.hint, { color: c.textSoft, fontSize: 15 }]}>{a.note}</Text>}
              </View>
              <Ionicons name="create-outline" size={20} color={c.textMuted} />
            </View>
          </Card>
        );
      })}
      <Button label={t('Νέο ραντεβού', 'New appointment')} kind="primary" icon="add" onPress={openNew} />
      <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>
        {t(
          `Θα έρθει ειδοποίηση ${formatMinutesWords(APPT_REMIND_MIN)} πριν από κάθε ραντεβού.`,
          `A reminder comes ${formatMinutesWords(APPT_REMIND_MIN)} before each appointment.`,
        )}
      </Text>

      {past.length > 0 && (
        <>
          <SectionTitle>{t('Προηγούμενα ραντεβού', 'Past appointments')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {past.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => openEdit(a)}
                style={({ pressed }) => [
                  st.pastRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[st.pastDate, { color: c.text }]}>
                  {formatDate(dateKey(a.at))} · {toHHMM(a.at)}
                </Text>
                {!!a.note && (
                  <Text style={[s.hint, { color: c.textSoft }]} numberOfLines={2}>
                    {a.note}
                  </Text>
                )}
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <Sheet visible={timeOpen != null} onClose={() => setTimeOpen(null)} title={t('Ώρα υπενθύμισης', 'Reminder time')}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            'Κάθε μέρα αυτή την ώρα, αν δεν έχεις πατήσει ακόμα «Έγινε».',
            'Every day at this time, if you haven\'t tapped "Done" yet.',
          )}
        </Text>
        {timeOpen != null && <TimePicker value={timeOpen} onChange={setTimeOpen} />}
        <Button
          label={t(`Αποθήκευση · ${timeOpen ?? ''}`, `Save · ${timeOpen ?? ''}`)}
          kind="primary"
          icon="checkmark"
          onPress={async () => {
            const time = timeOpen;
            if (!time) return;
            await act(d => setPhysioTime(d, time));
            toast(t(`Υπενθύμιση στις ${time}`, `Reminder at ${time}`));
            setTimeOpen(null);
          }}
        />
      </Sheet>

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.isNew ? t('Νέο ραντεβού', 'New appointment') : t('Ραντεβού', 'Appointment')}
      >
        {draft && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 2 }}
                kind={pick === 'date' ? 'primary' : 'secondary'}
                label={formatDate(draft.date)}
                icon="calendar-outline"
                onPress={() => setPick('date')}
              />
              <Button
                style={{ flex: 1 }}
                kind={pick === 'time' ? 'primary' : 'secondary'}
                label={draft.time}
                icon="time-outline"
                onPress={() => setPick('time')}
              />
            </View>
            {pick === 'date' ? (
              <DatePicker
                value={draft.date}
                onChange={date => {
                  setDraft({ ...draft, date });
                  setPick('time');
                }}
              />
            ) : (
              <TimePicker value={draft.time} onChange={time => setDraft({ ...draft, time })} />
            )}
            <Field
              label={t('Σημείωση', 'Note')}
              value={draft.note}
              onChangeText={note => setDraft({ ...draft, note })}
              multiline
              placeholder={t(
                'π.χ. πού, τι να φέρεις, τι είπε ο φυσικοθεραπευτής',
                'e.g. where, what to bring, what the physio said',
              )}
            />
            <Button label={t('Αποθήκευση', 'Save')} kind="primary" icon="checkmark" onPress={saveDraft} />
            {!draft.isNew && (
              <Button label={t('Διαγραφή', 'Delete')} kind="danger" icon="trash-outline" onPress={removeDraft} />
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...rounded, fontSize: 19, lineHeight: 25 },
  status: { fontSize: 15, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  big: { fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  cellDay: { fontSize: 11, fontWeight: '700', marginTop: 1, fontVariant: ['tabular-nums'] },
  dateBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  dateWeekday: { fontSize: 12, fontWeight: '700' },
  apptTitle: { fontSize: 17, fontWeight: '800' },
  pastRow: { paddingVertical: 12, gap: 2 },
  pastDate: { fontSize: 15, fontWeight: '700' },
});
