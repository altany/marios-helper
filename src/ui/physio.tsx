import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  appointmentsOn,
  physioDay,
  PhysioDayView,
  physioStreak,
  unmarkPhysio,
  upcomingAppointments,
} from '../engine/physio';
import { t } from '../i18n';
import { dateKey, daysBetween, formatDate, toHHMM } from '../lib/time';
import { AppData, Appointment } from '../model/types';
import { act, physioDone } from '../notify/commands';
import { Button, Card, s } from './components';
import { rounded, useColors } from './theme';
import { toast } from './toast';

/** "σήμερα στις 17:30", "αύριο στις 17:30", "Τρίτη 21 Οκτ στις 17:30" */
export const apptWhen = (appt: Appointment, today: string) => {
  const day = dateKey(appt.at);
  const diff = daysBetween(today, day);
  const when = diff === 0 ? t('σήμερα', 'today') : diff === 1 ? t('αύριο', 'tomorrow') : formatDate(day);
  return t(`${when} στις ${toHHMM(appt.at)}`, `${when} at ${toHHMM(appt.at)}`);
};

export const PhysioIcon = ({ size = 46 }: { size?: number }) => {
  const c = useColors();
  return (
    <View style={[st.icon, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft }]}>
      <MaterialCommunityIcons name="dumbbell" size={size * 0.55} color={c.accentText} />
    </View>
  );
};

/** How the exercises of `day` stand, in a few words. Null when daily exercises are off. */
export const physioStatusText = (day: PhysioDayView) => {
  switch (day.status) {
    case 'done':
      return day.doneAt != null && dateKey(day.doneAt) === day.date
        ? t(`Έγινε στις ${toHHMM(day.doneAt)}`, `Done at ${toHHMM(day.doneAt)}`)
        : t('Έγινε', 'Done');
    case 'due':
      return t('Δεν έγινε ακόμα', 'Not done yet');
    case 'upcoming':
      return t(`Υπενθύμιση στις ${toHHMM(day.dueAt)}`, `Reminder at ${toHHMM(day.dueAt)}`);
    case 'missed':
      return t('Δεν σημειώθηκε', 'Not marked as done');
    case 'off':
      return null;
  }
};

/** "Έγινε" for today, "Σημείωσε ότι έγινε" for a past day, "Αναίρεση" once done. */
export const PhysioActions = ({ day, today }: { day: PhysioDayView; today: string }) => {
  if (day.status === 'done') {
    return (
      <Button
        small
        kind="ghost"
        label={t('Αναίρεση', 'Undo')}
        icon="arrow-undo-outline"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => act(d => unmarkPhysio(d, day.date))}
      />
    );
  }
  if (day.date === today && (day.status === 'due' || day.status === 'upcoming')) {
    return (
      <Button
        label={t('Έγινε', 'Done')}
        kind="success"
        icon="checkmark"
        onPress={async () => {
          await physioDone(day.date);
          toast(t('Φυσικοθεραπεία: έγινε', 'Physio: done'));
        }}
      />
    );
  }
  if (day.status === 'missed') {
    return (
      <Button
        small
        label={t('Σημείωσε ότι έγινε', 'Mark as done')}
        icon="checkmark"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => physioDone(day.date)}
      />
    );
  }
  return null;
};

/** On the Today screen: the day's exercises and visits. Hidden when there is nothing to show. */
export const PhysioCard = ({ data, date, now }: { data: AppData; date: string; now: number }) => {
  const c = useColors();
  const today = dateKey(now);
  const day = physioDay(data, date, now);
  const visits = appointmentsOn(data, date);
  const next = date === today ? upcomingAppointments(data, now).find(a => dateKey(a.at) > today) : undefined;
  const status = physioStatusText(day);
  if (!status && visits.length === 0 && !next) return null;

  const streak = date === today ? physioStreak(data, now) : 0;
  const statusColor =
    day.status === 'done' ? c.success : day.status === 'missed' ? c.danger : day.status === 'due' ? c.warn : c.textSoft;

  return (
    <Card
      onPress={() => router.push('/physio')}
      style={day.status === 'due' && { borderColor: c.warn, borderWidth: 2 }}
    >
      <View style={st.head}>
        <PhysioIcon />
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: c.text }]}>{t('Φυσικοθεραπεία', 'Physio')}</Text>
          {!!status && (
            <View style={st.statusRow}>
              {day.status === 'done' && <Ionicons name="checkmark-circle" size={16} color={c.success} />}
              <Text style={[st.status, { color: statusColor }]}>{status}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </View>

      <PhysioActions day={day} today={today} />

      {streak >= 2 && (
        <View style={st.line}>
          <Ionicons name="paw" size={15} color={c.accentText} />
          <Text style={[st.lineText, { color: c.accentText }]}>
            {t(`${streak} μέρες στη σειρά`, `${streak} days in a row`)}
          </Text>
        </View>
      )}

      {visits.map(a => (
        <View key={a.id} style={[st.visit, { backgroundColor: c.warnSoft }]}>
          <Ionicons name="calendar" size={16} color={c.warn} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>
              {t(`Ραντεβού στις ${toHHMM(a.at)}`, `Appointment at ${toHHMM(a.at)}`)}
            </Text>
            {!!a.note.trim() && (
              <Text style={[s.hint, { color: c.textSoft }]} numberOfLines={2}>
                {a.note.trim()}
              </Text>
            )}
          </View>
        </View>
      ))}

      {next && (
        <View style={st.line}>
          <Ionicons name="calendar-outline" size={15} color={c.textSoft} />
          <Text style={[st.lineText, { color: c.textSoft }]}>
            {t(`Επόμενο ραντεβού: ${apptWhen(next, today)}`, `Next appointment: ${apptWhen(next, today)}`)}
          </Text>
        </View>
      )}
    </Card>
  );
};

const st = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...rounded, fontSize: 19, lineHeight: 25 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { fontSize: 15, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { fontSize: 14, fontWeight: '700', flex: 1 },
  visit: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12 },
});
