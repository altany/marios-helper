import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, ActivityIndicator,
} from 'react-native';
import {
  getMedicationSettings, saveMedicationSettings,
  DEFAULT_SETTINGS, MedicationSchedule,
} from '../services/medicationSettings';
import { resetAndRescheduleNotifications } from '../services/notifications';

const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function SettingsScreen() {
  const [settings, setSettings] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addHourFor, setAddHourFor] = useState<string | null>(null);

  useEffect(() => {
    getMedicationSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const toggleEnabled = (id: string) =>
    setSettings(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));

  const updateBody = (id: string, body: string) =>
    setSettings(prev => prev.map(m => m.id === id ? { ...m, body } : m));

  const removeTime = (id: string, hour: number) =>
    setSettings(prev => prev.map(m =>
      m.id === id ? { ...m, times: m.times.filter(t => t !== hour) } : m,
    ));

  const addTime = (id: string, hour: number) => {
    setSettings(prev => prev.map(m =>
      m.id === id ? { ...m, times: [...m.times, hour].sort((a, b) => a - b) } : m,
    ));
    setAddHourFor(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveMedicationSettings(settings);
      await resetAndRescheduleNotifications();
      Alert.alert('Αποθηκεύτηκε', 'Οι ειδοποιήσεις επαναπρογραμματίστηκαν.');
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αποθήκευση.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () =>
    Alert.alert(
      'Επαναφορά',
      'Να επαναφερθούν οι προεπιλεγμένες ρυθμίσεις;',
      [
        { text: 'Άκυρο', style: 'cancel' },
        { text: 'Επαναφορά', style: 'destructive', onPress: () => setSettings(DEFAULT_SETTINGS) },
      ],
    );

  if (loading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color="#317181" size="large" />
      </View>
    );
  }

  const currentMed = settings.find(m => m.id === addHourFor);
  const availableHours = currentMed
    ? Array.from({ length: 24 }, (_, i) => i).filter(h => !currentMed.times.includes(h))
    : [];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Ρυθμίσεις φαρμάκων</Text>

      {settings.map(med => (
        <View key={med.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{med.name}</Text>
            <Switch
              value={med.enabled}
              onValueChange={() => toggleEnabled(med.id)}
              trackColor={{ false: '#444', true: '#317181' }}
              thumbColor="#fff"
            />
          </View>

          <Text style={s.label}>Κείμενο ειδοποίησης</Text>
          <TextInput
            style={[s.input, !med.enabled && s.inputDisabled]}
            value={med.body}
            onChangeText={text => updateBody(med.id, text)}
            multiline
            editable={med.enabled}
            placeholderTextColor="#555"
          />

          <Text style={s.label}>Ώρες</Text>
          <View style={s.timesRow}>
            {med.times.map(hour => (
              <View key={hour} style={s.chip}>
                <Text style={s.chipText}>{formatHour(hour)}</Text>
                <TouchableOpacity
                  onPress={() => removeTime(med.id, hour)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.chipRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {med.enabled && (
              <TouchableOpacity style={s.addChip} onPress={() => setAddHourFor(med.id)}>
                <Text style={s.addChipText}>+ Ώρα</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.resetBtn} onPress={resetToDefaults}>
        <Text style={s.resetBtnText}>Επαναφορά προεπιλογών</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={s.saveBtnText}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση & Εφαρμογή'}</Text>
      </TouchableOpacity>

      {/* Hour picker modal */}
      <Modal
        visible={!!addHourFor}
        transparent
        animationType="fade"
        onRequestClose={() => setAddHourFor(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Επιλογή ώρας</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {availableHours.map(hour => (
                <TouchableOpacity
                  key={hour}
                  style={s.hourRow}
                  onPress={() => addHourFor && addTime(addHourFor, hour)}
                >
                  <Text style={s.hourRowText}>{formatHour(hour)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAddHourFor(null)}>
              <Text style={s.cancelBtnText}>Άκυρο</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13131f',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    color: '#cdd6f4',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  label: {
    color: '#a6adc8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#2a2a3e',
    color: '#cdd6f4',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 52,
  },
  inputDisabled: {
    opacity: 0.4,
  },
  timesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#317181',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemove: {
    color: '#ffffffcc',
    fontSize: 18,
    lineHeight: 18,
  },
  addChip: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#317181',
  },
  addChipText: {
    color: '#317181',
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    alignSelf: 'center',
    padding: 10,
    marginVertical: 4,
  },
  resetBtnText: {
    color: '#585b70',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#317181',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 20,
    width: '70%',
    maxHeight: '70%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  hourRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  hourRowText: {
    color: '#cdd6f4',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    padding: 8,
  },
  cancelBtnText: {
    color: '#585b70',
    fontSize: 15,
  },
});
