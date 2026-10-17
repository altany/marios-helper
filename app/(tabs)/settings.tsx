import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { MAX_REPEATS } from '../../src/engine/plan';
import { t } from '../../src/i18n';
import { formatMinutes } from '../../src/lib/time';
import { defaultData } from '../../src/model/defaults';
import { AppData, Settings } from '../../src/model/types';
import { createChannels } from '../../src/notify/channels';
import { act } from '../../src/notify/commands';
import { Check, runChecks, sendTestNotification } from '../../src/notify/health';
import { clearLog, readLog } from '../../src/notify/log';
import { syncNotifications } from '../../src/notify/sync';
import { getData, replaceAll, useData } from '../../src/store/store';
import {
  Button,
  Card,
  Choice,
  Divider,
  Field,
  Loading,
  s,
  Screen,
  SectionTitle,
  Sheet,
  SwitchRow,
} from '../../src/ui/components';
import { useColors } from '../../src/ui/theme';
import { updateLabel } from '../../src/updates';
import { toast } from '../../src/ui/toast';

const minutes = (list: number[], zero?: string) =>
  list.map(m => ({ value: m, label: m === 0 && zero ? zero : formatMinutes(m) }));

export default function SettingsScreen() {
  const c = useColors();
  const data = useData();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [logLines, setLogLines] = useState<string[]>([]);

  const refreshChecks = useCallback(() => {
    runChecks()
      .then(setChecks)
      .catch(() => setChecks([]));
    readLog().then(setLogLines);
  }, []);
  useFocusEffect(refreshChecks);
  // Coming back from the phone's settings: show the new state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => state === 'active' && refreshChecks());
    return () => sub.remove();
  }, [refreshChecks]);

  if (!data) return <Loading />;
  const set = (patch: Partial<Settings>) =>
    act(d => {
      d.settings = { ...d.settings, ...patch };
    });

  // Channel names (in the phone's notification settings) follow the language too.
  const setLanguage = async (language: Settings['language']) => {
    await set({ language });
    await createChannels();
  };

  const exportData = async () => {
    const json = JSON.stringify(await getData(), null, 1);
    await Share.share({ title: 'Mario backup', message: json });
  };

  const importData = async () => {
    try {
      const parsed = JSON.parse(importText) as AppData;
      if (!Array.isArray(parsed.meds) || !Array.isArray(parsed.routines)) throw new Error('bad');
      await replaceAll(parsed);
      await syncNotifications('restore from a backup');
      setImportOpen(false);
      setImportText('');
      toast(t('Τα δεδομένα επανήλθαν', 'Your data is back'));
    } catch {
      Alert.alert(
        t('Δεν έγινε', "That didn't work"),
        t('Το κείμενο δεν είναι αντίγραφο ασφαλείας αυτής της εφαρμογής.', "The text isn't a backup from this app."),
      );
    }
  };

  const resetAll = () =>
    Alert.alert(
      t('Επαναφορά', 'Reset'),
      t(
        'Να σβηστούν όλα (φάρμακα, πρόγραμμα, ιστορικό) και να ξεκινήσεις από την αρχή;',
        'Delete everything (medicines, schedule, history) and start again?',
      ),
      [
        { text: t('Άκυρο', 'Cancel'), style: 'cancel' },
        {
          text: t('Σβήσιμο όλων', 'Delete everything'),
          style: 'destructive',
          onPress: async () => {
            await replaceAll(defaultData());
            await syncNotifications('delete everything');
            toast(t('Έγινε επαναφορά', 'Everything was reset'));
          },
        },
      ],
    );

  const problems = checks?.filter(ch => ch.ok === false).length ?? 0;

  return (
    <Screen title={t('Ρυθμίσεις', 'Settings')}>
      <SectionTitle>{t('Ειδοποιήσεις', 'Reminders')}</SectionTitle>
      <Card style={{ gap: 14 }}>
        <SwitchRow
          label={t('Ειδοποιήσεις ενεργές', 'Reminders on')}
          hint={
            data.settings.paused
              ? t(
                  'Σε παύση: δεν έρχεται καμία ειδοποίηση. Το πρόγραμμα μένει όπως είναι.',
                  'Paused: no reminders come. The schedule stays as it is.',
                )
              : t(
                  "Κλείσ' το για παύση όλων (π.χ. όταν ο " + data.settings.petName + ' μένει στον κτηνίατρο).',
                  'Turn it off to pause them all (e.g. when ' + data.settings.petName + ' is staying at the vet).',
                )
          }
          value={!data.settings.paused}
          onChange={on => set({ paused: !on })}
        />
        <Divider />
        <Field
          label={t('Όνομα κατοικιδίου', "Pet's name")}
          defaultValue={data.settings.petName}
          onEndEditing={e => {
            const petName = e.nativeEvent.text.trim();
            if (petName && petName !== data.settings.petName) set({ petName });
          }}
          hint={t('Φαίνεται στον τίτλο κάθε ειδοποίησης.', 'Shown in the title of every reminder.')}
        />
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>
          {t('Κουμπί «Αργότερα» στην ειδοποίηση', '"Later" button on the reminder')}
        </Text>
        <Choice
          options={minutes([5, 10, 15, 20, 30, 60])}
          value={data.settings.snoozeMin}
          onChange={snoozeMin => set({ snoozeMin })}
        />
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>
          {t('Ξαναχτυπάει αν δεν απαντήσω κάθε', "If I don't answer, ring again every")}
        </Text>
        <Choice
          options={minutes([0, 5, 10, 15, 30], t('Ποτέ', 'Never'))}
          value={data.settings.repeatMin}
          onChange={repeatMin => set({ repeatMin })}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          {t(
            `Έως ${MAX_REPEATS} φορές. Μετά μένει στις ειδοποιήσεις χωρίς ήχο, μέχρι να πατήσεις κουμπί.`,
            `Up to ${MAX_REPEATS} times. Then it stays in the notifications without sound, until you tap a button.`,
          )}
        </Text>
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>
          {t('Η δόση θεωρείται χαμένη μετά από', 'A dose counts as missed after')}
        </Text>
        <Choice
          options={minutes([120, 240, 360, 720, 1440])}
          value={data.settings.missAfterMin}
          onChange={missAfterMin => set({ missAfterMin })}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          {t(
            'Μέχρι τότε η ειδοποίηση μένει μέχρι να πατήσεις «Το έδωσα» ή «Αργότερα». Μετά φεύγει μόνη της. Μπορείς πάντα να σημειώσεις τη δόση από την οθόνη «Σήμερα».',
            'Until then the reminder stays until you tap "I gave it" or "Later". After that it goes away by itself. You can always mark the dose on the Today screen.',
          )}
        </Text>
        <Divider />
        <SwitchRow
          label={t('Δεν σβήνει με σύρσιμο', "Can't be swiped away")}
          hint={t('Αν τη σύρεις χωρίς να απαντήσεις, ξαναεμφανίζεται αθόρυβα.', 'If you swipe it away without answering, it comes back silently.')}
          value={data.settings.sticky}
          onChange={sticky => set({ sticky })}
        />
        <SwitchRow
          label={t('Αντίστροφη μέτρηση', 'Countdown')}
          hint={t(
            'Μετά το «Το έδωσα» δείχνει πόσο μένει για το επόμενο φάρμακο της σειράς.',
            'After "I gave it", shows how long until the next medicine in the chain.',
          )}
          value={data.settings.countdown}
          onChange={countdown => set({ countdown })}
        />
        <SwitchRow
          label={t('Γάβγισμα', 'Bark')}
          hint={t(
            'Η ειδοποίηση για κάθε δόση γαβγίζει αντί για τον συνηθισμένο ήχο του κινητού.',
            "The reminder for each dose barks instead of the phone's usual sound.",
          )}
          value={data.settings.bark}
          onChange={bark => set({ bark })}
        />
        <SwitchRow
          label={t('Επίμονος ήχος', 'Keep ringing')}
          hint={t(
            'Ο ήχος επαναλαμβάνεται μέχρι να δεις την ειδοποίηση. Σαν ξυπνητήρι.',
            'The sound repeats until you look at the reminder. Like an alarm clock.',
          )}
          value={data.settings.insistent}
          onChange={insistent => set({ insistent })}
        />
      </Card>

      {Platform.OS !== 'web' && (
        <>
          <SectionTitle>
            {t('Έλεγχος', 'Check')}{' '}
            {problems > 0
              ? t(`· ${problems} ${problems === 1 ? 'θέμα' : 'θέματα'}`, `· ${problems} ${problems === 1 ? 'issue' : 'issues'}`)
              : ''}
          </SectionTitle>
          <Card style={{ gap: 14 }}>
            <Text style={[s.hint, { color: c.textSoft }]}>
              {t(
                'Για να έρχονται οι ειδοποιήσεις στην ώρα τους, ακόμα κι όταν η εφαρμογή είναι κλειστή.',
                'So that reminders come on time, even when the app is closed.',
              )}
            </Text>
            {checks?.map(ch => (
              <View key={ch.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons
                  name={ch.ok === null ? 'information-circle' : ch.ok ? 'checkmark-circle' : 'warning'}
                  size={22}
                  color={ch.ok === null ? c.textSoft : ch.ok ? c.success : c.warn}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[s.rowLabel, { color: c.text, fontSize: 15 }]}>{ch.label}</Text>
                  <Text style={[s.hint, { color: c.textMuted }]}>{ch.help}</Text>
                  {ch.fix && (
                    <Button
                      small
                      kind={ch.ok === false ? 'primary' : 'ghost'}
                      label={ch.fixLabel ?? t('Άνοιγμα', 'Open')}
                      style={{ alignSelf: 'flex-start' }}
                      onPress={async () => {
                        await ch.fix!();
                        setTimeout(refreshChecks, 800);
                      }}
                    />
                  )}
                </View>
              </View>
            ))}
            <Button
              label={t('Δοκιμαστική ειδοποίηση σε 5″', 'Test reminder in 5 seconds')}
              icon="notifications-outline"
              onPress={async () => {
                await sendTestNotification(5);
                toast(t('Κλείσε την εφαρμογή και περίμενε 5 δευτερόλεπτα', 'Close the app and wait 5 seconds'));
              }}
            />
          </Card>
        </>
      )}

      <SectionTitle>Γλώσσα · Language</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Choice
          options={[
            { value: 'auto', label: t('Του κινητού', 'Same as phone') },
            { value: 'el', label: 'Ελληνικά' },
            { value: 'en', label: 'English' },
          ]}
          value={data.settings.language}
          onChange={language => setLanguage(language)}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          {t(
            'Αλλάζει και τα κείμενα των ειδοποιήσεων. Τα ονόματα και οι οδηγίες των φαρμάκων μένουν όπως τα έγραψες.',
            "Reminder texts change too. Medicine names and instructions stay as you wrote them.",
          )}
        </Text>
      </Card>

      <SectionTitle>{t('Αρχείο ειδοποιήσεων', 'Notification log')}</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            'Γράφει πότε εμφανίστηκε κάθε ειδοποίηση, με ήχο ή χωρίς, και γιατί. Στείλ\' το αν κάτι χτυπάει χωρίς λόγο.',
            'It notes when each reminder appeared, with or without sound, and why. Send it if something rings for no reason.',
          )}
        </Text>
        {logLines.length > 0 && (
          <Text style={[st.log, { color: c.textSoft, backgroundColor: c.input }]}>{logLines.slice(-8).join('\n')}</Text>
        )}
        <Button
          label={t(`Αποστολή αρχείου (${logLines.length} γραμμές)`, `Send the log (${logLines.length} lines)`)}
          icon="share-outline"
          disabled={logLines.length === 0}
          onPress={async () => {
            const lines = await readLog();
            await Share.share({ title: 'Mario log', message: lines.join('\n') });
          }}
        />
        <Button
          small
          kind="ghost"
          label={t('Καθαρισμός αρχείου', 'Clear the log')}
          icon="trash-outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={async () => {
            await clearLog();
            setLogLines([]);
          }}
        />
      </Card>

      <SectionTitle>{t('Δεδομένα', 'Data')}</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            "Όλα μένουν μόνο σε αυτό το κινητό. Κράτα ένα αντίγραφο (π.χ. στείλ' το στον εαυτό σου) πριν αλλάξεις κινητό.",
            'Everything stays on this phone only. Keep a backup (e.g. send it to yourself) before you change phones.',
          )}
        </Text>
        <Button label={t('Αντίγραφο ασφαλείας', 'Back up')} icon="share-outline" onPress={exportData} />
        <Button
          label={t('Επαναφορά από αντίγραφο', 'Restore from a backup')}
          icon="download-outline"
          onPress={() => setImportOpen(true)}
        />
        <Button label={t('Σβήσιμο όλων', 'Delete everything')} kind="danger" icon="trash-outline" onPress={resetAll} />
      </Card>

      <Text style={[s.hint, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>
        Mario · {t('έκδοση', 'version')} {Constants.expoConfig?.version ?? '—'}
        {updateLabel() ? ` · ${updateLabel()}` : ''} · 🐾
      </Text>

      <Sheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('Επαναφορά από αντίγραφο', 'Restore from a backup')}
      >
        <Text style={[s.hint, { color: c.textSoft }]}>
          {t(
            'Επικόλλησε εδώ το κείμενο του αντιγράφου. Θα αντικαταστήσει ό,τι υπάρχει τώρα.',
            'Paste the backup text here. It will replace everything that is there now.',
          )}
        </Text>
        <Field
          label={t('Αντίγραφο', 'Backup')}
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder='{"version":3,...}'
        />
        <Button
          label={t('Επαναφορά', 'Restore')}
          kind="primary"
          icon="checkmark"
          onPress={importData}
          disabled={!importText.trim()}
        />
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  log: {
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 15,
    borderRadius: 10,
    padding: 10,
  },
});
