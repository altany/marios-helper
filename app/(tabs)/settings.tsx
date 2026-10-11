import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Share, Text, View } from 'react-native';
import { MAX_REPEATS } from '../../src/engine/plan';
import { formatMinutes } from '../../src/lib/time';
import { defaultData } from '../../src/model/defaults';
import { AppData, Settings } from '../../src/model/types';
import { act } from '../../src/notify/commands';
import { Check, runChecks, sendTestNotification } from '../../src/notify/health';
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
import { toast } from '../../src/ui/toast';

const minutes = (list: number[], zero?: string) =>
  list.map(m => ({ value: m, label: m === 0 && zero ? zero : formatMinutes(m) }));

export default function SettingsScreen() {
  const c = useColors();
  const data = useData();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const refreshChecks = useCallback(() => {
    runChecks()
      .then(setChecks)
      .catch(() => setChecks([]));
  }, []);
  useFocusEffect(refreshChecks);

  if (!data) return <Loading />;
  const set = (patch: Partial<Settings>) =>
    act(d => {
      d.settings = { ...d.settings, ...patch };
    });

  const exportData = async () => {
    const json = JSON.stringify(await getData(), null, 1);
    await Share.share({ title: 'Mario backup', message: json });
  };

  const importData = async () => {
    try {
      const parsed = JSON.parse(importText) as AppData;
      if (!Array.isArray(parsed.meds) || !Array.isArray(parsed.routines)) throw new Error('bad');
      await replaceAll(parsed);
      await syncNotifications();
      setImportOpen(false);
      setImportText('');
      toast('Τα δεδομένα επανήλθαν');
    } catch {
      Alert.alert('Δεν έγινε', 'Το κείμενο δεν είναι αντίγραφο ασφαλείας αυτής της εφαρμογής.');
    }
  };

  const resetAll = () =>
    Alert.alert('Επαναφορά', 'Να σβηστούν όλα (φάρμακα, πρόγραμμα, ιστορικό) και να ξεκινήσεις από την αρχή;', [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Σβήσιμο όλων',
        style: 'destructive',
        onPress: async () => {
          await replaceAll(defaultData(Date.now()));
          await syncNotifications();
          toast('Έγινε επαναφορά');
        },
      },
    ]);

  const problems = checks?.filter(ch => !ch.ok).length ?? 0;

  return (
    <Screen title="Ρυθμίσεις">
      <SectionTitle>Ειδοποιήσεις</SectionTitle>
      <Card style={{ gap: 14 }}>
        <SwitchRow
          label="Ειδοποιήσεις ενεργές"
          hint={
            data.settings.paused
              ? 'Σε παύση: δεν έρχεται καμία ειδοποίηση. Το πρόγραμμα μένει όπως είναι.'
              : "Κλείσ' το για παύση όλων (π.χ. όταν ο " + data.settings.petName + ' μένει στον κτηνίατρο).'
          }
          value={!data.settings.paused}
          onChange={on => set({ paused: !on })}
        />
        <Divider />
        <Field
          label="Όνομα κατοικιδίου"
          defaultValue={data.settings.petName}
          onEndEditing={e => {
            const petName = e.nativeEvent.text.trim();
            if (petName && petName !== data.settings.petName) set({ petName });
          }}
          hint="Φαίνεται στον τίτλο κάθε ειδοποίησης."
        />
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>Κουμπί «Αργότερα» στην ειδοποίηση</Text>
        <Choice
          options={minutes([5, 10, 15, 20, 30, 60])}
          value={data.settings.snoozeMin}
          onChange={snoozeMin => set({ snoozeMin })}
        />
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>Ξαναχτυπάει αν δεν απαντήσω κάθε</Text>
        <Choice
          options={minutes([0, 5, 10, 15, 30], 'Ποτέ')}
          value={data.settings.repeatMin}
          onChange={repeatMin => set({ repeatMin })}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          Έως {MAX_REPEATS} φορές. Μετά μένει στις ειδοποιήσεις χωρίς ήχο, μέχρι να πατήσεις κουμπί.
        </Text>
        <Divider />
        <Text style={[s.label, { color: c.textSoft }]}>Η δόση θεωρείται χαμένη μετά από</Text>
        <Choice
          options={minutes([120, 240, 360, 720, 1440])}
          value={data.settings.missAfterMin}
          onChange={missAfterMin => set({ missAfterMin })}
        />
        <Text style={[s.hint, { color: c.textMuted }]}>
          Μέχρι τότε η ειδοποίηση μένει μέχρι να πατήσεις «Το έδωσα» ή «Αργότερα». Μετά φεύγει μόνη της. Μπορείς πάντα
          να σημειώσεις τη δόση από την οθόνη «Σήμερα».
        </Text>
        <Divider />
        <SwitchRow
          label="Δεν σβήνει με σύρσιμο"
          hint="Αν τη σύρεις χωρίς να απαντήσεις, ξαναεμφανίζεται αθόρυβα."
          value={data.settings.sticky}
          onChange={sticky => set({ sticky })}
        />
        <SwitchRow
          label="Αντίστροφη μέτρηση"
          hint="Μετά το «Το έδωσα» δείχνει πόσο μένει για το επόμενο φάρμακο της σειράς."
          value={data.settings.countdown}
          onChange={countdown => set({ countdown })}
        />
        <SwitchRow
          label="Επίμονος ήχος"
          hint="Ο ήχος επαναλαμβάνεται μέχρι να δεις την ειδοποίηση. Σαν ξυπνητήρι."
          value={data.settings.insistent}
          onChange={insistent => set({ insistent })}
        />
      </Card>

      {Platform.OS !== 'web' && (
        <>
          <SectionTitle>
            Έλεγχος {problems > 0 ? `· ${problems} ${problems === 1 ? 'θέμα' : 'θέματα'}` : ''}
          </SectionTitle>
          <Card style={{ gap: 14 }}>
            <Text style={[s.hint, { color: c.textSoft }]}>
              Για να έρχονται οι ειδοποιήσεις στην ώρα τους, ακόμα κι όταν η εφαρμογή είναι κλειστή.
            </Text>
            {checks?.map(ch => (
              <View key={ch.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name={ch.ok ? 'checkmark-circle' : 'warning'} size={22} color={ch.ok ? c.success : c.warn} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[s.rowLabel, { color: c.text, fontSize: 15 }]}>{ch.label}</Text>
                  <Text style={[s.hint, { color: c.textMuted }]}>{ch.help}</Text>
                  {ch.fix && (
                    <Button
                      small
                      kind={ch.ok ? 'ghost' : 'primary'}
                      label={ch.fixLabel ?? 'Άνοιγμα'}
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
              label="Δοκιμαστική ειδοποίηση σε 5″"
              icon="notifications-outline"
              onPress={async () => {
                await sendTestNotification(5);
                toast('Κλείσε την εφαρμογή και περίμενε 5 δευτερόλεπτα');
              }}
            />
          </Card>
        </>
      )}

      <SectionTitle>Δεδομένα</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={[s.hint, { color: c.textSoft }]}>
          Όλα μένουν μόνο σε αυτό το κινητό. Κράτα ένα αντίγραφο (π.χ. στείλ' το στον εαυτό σου) πριν αλλάξεις κινητό.
        </Text>
        <Button label="Αντίγραφο ασφαλείας" icon="share-outline" onPress={exportData} />
        <Button label="Επαναφορά από αντίγραφο" icon="download-outline" onPress={() => setImportOpen(true)} />
        <Button label="Σβήσιμο όλων" kind="danger" icon="trash-outline" onPress={resetAll} />
      </Card>

      <Text style={[s.hint, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>
        Mario · έκδοση {Constants.expoConfig?.version ?? '—'} · 🐾
      </Text>

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="Επαναφορά από αντίγραφο">
        <Text style={[s.hint, { color: c.textSoft }]}>
          Επικόλλησε εδώ το κείμενο του αντιγράφου. Θα αντικαταστήσει ό,τι υπάρχει τώρα.
        </Text>
        <Field
          label="Αντίγραφο"
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder='{"version":3,...}'
        />
        <Button label="Επαναφορά" kind="primary" icon="checkmark" onPress={importData} disabled={!importText.trim()} />
      </Sheet>
    </Screen>
  );
}
