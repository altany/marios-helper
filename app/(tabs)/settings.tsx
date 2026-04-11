import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, ActivityIndicator,
} from 'react-native';
import {
  getMedicationSettings, saveMedicationSettings,
  DEFAULT_SETTINGS, MedicationSchedule, ChainStep,
} from '../services/medicationSettings';
import { resetAndRescheduleNotifications } from '../services/notifications';

const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

type ChainForm = { name: string; body: string; delayMinutes: string };
const emptyChainForm = (): ChainForm => ({ name: '', body: '', delayMinutes: '20' });

export default function SettingsScreen() {
  const [settings, setSettings] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addHourFor, setAddHourFor] = useState<string | null>(null);

  // { medId, stepIndex: null = new step, number = edit existing }
  const [chainModal, setChainModal] = useState<{ medId: string; stepIndex: number | null } | null>(null);
  const [chainForm, setChainForm] = useState<ChainForm>(emptyChainForm());

  const [newMedModal, setNewMedModal] = useState(false);
  const [newMedForm, setNewMedForm] = useState({ name: '', body: '' });

  useEffect(() => {
    getMedicationSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  // ── Medication mutations ──────────────────────────────────────────

  const toggleEnabled = (id: string) =>
    setSettings(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));

  const updateField = (id: string, field: 'name' | 'body' | 'groupTitle', value: string) =>
    setSettings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

  const removeMed = (id: string) =>
    Alert.alert('Διαγραφή', 'Να διαγραφεί αυτό το φάρμακο;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: () =>
        setSettings(prev => prev.filter(m => m.id !== id))
      },
    ]);

  const confirmAddMed = () => {
    if (!newMedForm.name.trim()) return;
    setSettings(prev => [...prev, {
      id: genId(),
      name: newMedForm.name.trim(),
      body: newMedForm.body.trim(),
      times: [],
      enabled: true,
    }]);
    setNewMedModal(false);
    setNewMedForm({ name: '', body: '' });
  };

  // ── Time mutations ────────────────────────────────────────────────

  const removeTime = (id: string, hour: number) =>
    setSettings(prev => prev.map(m =>
      m.id === id ? {
        ...m,
        times: m.times.filter(t => t !== hour),
        chainAtHours: m.chainAtHours?.filter(h => h !== hour),
      } : m,
    ));

  const addTime = (id: string, hour: number) => {
    setSettings(prev => prev.map(m =>
      m.id === id ? { ...m, times: [...m.times, hour].sort((a, b) => a - b) } : m,
    ));
    setAddHourFor(null);
  };

  // ── Chain hour toggles ────────────────────────────────────────────

  const toggleChainHour = (medId: string, hour: number) =>
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      const cur = m.chainAtHours ?? [];
      const updated = cur.includes(hour)
        ? cur.filter(h => h !== hour)
        : [...cur, hour].sort((a, b) => a - b);
      return { ...m, chainAtHours: updated };
    }));

  // ── Chain step mutations ──────────────────────────────────────────

  const openAddStep = (medId: string) => {
    setChainModal({ medId, stepIndex: null });
    setChainForm(emptyChainForm());
  };

  const openEditStep = (medId: string, stepIndex: number, step: ChainStep) => {
    setChainModal({ medId, stepIndex });
    setChainForm({ name: step.name, body: step.body, delayMinutes: String(step.delayMinutes) });
  };

  const saveChainStep = () => {
    if (!chainModal || !chainForm.name.trim()) return;
    const { medId, stepIndex } = chainModal;
    const step: ChainStep = {
      id: stepIndex !== null
        ? (settings.find(m => m.id === medId)?.chain?.[stepIndex]?.id ?? genId())
        : genId(),
      name: chainForm.name.trim(),
      body: chainForm.body.trim(),
      delayMinutes: Math.max(1, parseInt(chainForm.delayMinutes) || 20),
    };
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      const chain = [...(m.chain ?? [])];
      if (stepIndex !== null) chain[stepIndex] = step;
      else chain.push(step);
      return { ...m, chain };
    }));
    setChainModal(null);
  };

  const removeChainStep = (medId: string, stepIndex: number) =>
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      const chain = (m.chain ?? []).filter((_, i) => i !== stepIndex);
      return {
        ...m,
        chain: chain.length > 0 ? chain : undefined,
        chainAtHours: chain.length > 0 ? m.chainAtHours : undefined,
      };
    }));

  // ── Save / reset ─────────────────────────────────────────────────

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
    Alert.alert('Επαναφορά', 'Να επαναφερθούν οι προεπιλεγμένες ρυθμίσεις;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Επαναφορά', style: 'destructive', onPress: () => setSettings(DEFAULT_SETTINGS) },
    ]);

  // ─────────────────────────────────────────────────────────────────

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

          {/* ── Group title + controls ── */}
          <View style={s.cardHeader}>
            <TextInput
              style={s.groupTitleInput}
              value={med.groupTitle ?? ''}
              onChangeText={v => updateField(med.id, 'groupTitle', v)}
              placeholder="Τίτλος ομάδας"
              placeholderTextColor="#555"
            />
            <Switch
              value={med.enabled}
              onValueChange={() => toggleEnabled(med.id)}
              trackColor={{ false: '#444', true: '#317181' }}
              thumbColor="#fff"
            />
            <TouchableOpacity onPress={() => removeMed(med.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.deleteIcon}>🗑</Text>
            </TouchableOpacity>
          </View>

          {/* ── Times ── */}
          <Text style={s.label}>Ώρες</Text>
          <View style={s.chipRow}>
            {med.times.map(hour => (
              <View key={hour} style={s.chip}>
                <Text style={s.chipText}>{formatHour(hour)}</Text>
                <TouchableOpacity onPress={() => removeTime(med.id, hour)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

          {/* ── Chain: all steps with equal styling ── */}
          <Text style={s.label}>
            Φάρμακα <Text style={s.labelHint}>(αλυσίδα)</Text>
          </Text>

          {/* First step = the medication itself */}
          <View style={s.medStep}>
            <TextInput
              style={s.stepNameInput}
              value={med.name}
              onChangeText={v => updateField(med.id, 'name', v)}
              placeholder="Όνομα φαρμάκου"
              placeholderTextColor="#555"
            />
            <TextInput
              style={[s.stepBodyInput, !med.enabled && s.inputDisabled]}
              value={med.body}
              onChangeText={v => updateField(med.id, 'body', v)}
              multiline
              editable={med.enabled}
              placeholder="Δόση / κείμενο ειδοποίησης"
              placeholderTextColor="#555"
            />
          </View>

          {/* Chain hour selector — only if chain steps exist */}
          {(med.chain?.length ?? 0) > 0 && med.times.length > 0 && (
            <>
              <Text style={s.sublabel}>Αλυσίδα ενεργή στις:</Text>
              <View style={s.chipRow}>
                {med.times.map(hour => {
                  const active = med.chainAtHours?.includes(hour) ?? false;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[s.chip, active ? s.chipChainOn : s.chipChainOff]}
                      onPress={() => toggleChainHour(med.id, hour)}
                    >
                      <Text style={[s.chipText, !active && s.chipTextOff]}>
                        {formatHour(hour)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Subsequent chain steps — same styling as the first */}
          {(med.chain ?? []).map((step, idx) => (
            <View key={step.id}>
              <View style={s.chainConnector}>
                <View style={s.chainLine} />
                <Text style={s.chainDelay}>+{step.delayMinutes} λεπτά</Text>
                <View style={s.chainLine} />
              </View>
              <TouchableOpacity
                style={s.medStep}
                onPress={() => openEditStep(med.id, idx, step)}
                activeOpacity={0.75}
              >
                <View style={s.stepRow}>
                  <Text style={s.stepNameStatic}>{step.name || '—'}</Text>
                  <TouchableOpacity
                    onPress={() => removeChainStep(med.id, idx)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.chainStepRemove}>×</Text>
                  </TouchableOpacity>
                </View>
                {!!step.body && (
                  <Text style={s.stepBodyStatic} numberOfLines={2}>{step.body}</Text>
                )}
                <Text style={s.tapToEdit}>Πάτα για επεξεργασία</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={s.addStepBtn} onPress={() => openAddStep(med.id)}>
            <Text style={s.addStepBtnText}>+ Βήμα αλυσίδας</Text>
          </TouchableOpacity>

        </View>
      ))}

      {/* ── Add new medication ── */}
      <TouchableOpacity style={s.addMedBtn} onPress={() => setNewMedModal(true)}>
        <Text style={s.addMedBtnText}>+ Νέο φάρμακο</Text>
      </TouchableOpacity>

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

      {/* ── Hour picker modal ── */}
      <Modal visible={!!addHourFor} transparent animationType="fade" onRequestClose={() => setAddHourFor(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Επιλογή ώρας</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {availableHours.map(hour => (
                <TouchableOpacity key={hour} style={s.hourRow} onPress={() => addHourFor && addTime(addHourFor, hour)}>
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

      {/* ── Chain step add/edit modal ── */}
      <Modal visible={!!chainModal} transparent animationType="fade" onRequestClose={() => setChainModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>
              {chainModal?.stepIndex !== null ? 'Επεξεργασία βήματος' : 'Νέο βήμα αλυσίδας'}
            </Text>

            <Text style={s.formLabel}>Όνομα φαρμάκου</Text>
            <TextInput
              style={s.formInput}
              value={chainForm.name}
              onChangeText={v => setChainForm(f => ({ ...f, name: v }))}
              placeholder="π.χ. Lacrimmune"
              placeholderTextColor="#555"
              autoFocus
            />

            <Text style={s.formLabel}>Δόση / κείμενο ειδοποίησης</Text>
            <TextInput
              style={[s.formInput, { minHeight: 64 }]}
              value={chainForm.body}
              onChangeText={v => setChainForm(f => ({ ...f, body: v }))}
              placeholder="π.χ. 1 κόκκος ρυζιού στο αριστερό μάτι"
              placeholderTextColor="#555"
              multiline
            />

            <Text style={s.formLabel}>Καθυστέρηση (λεπτά μετά το προηγούμενο)</Text>
            <TextInput
              style={s.formInput}
              value={chainForm.delayMinutes}
              onChangeText={v => setChainForm(f => ({ ...f, delayMinutes: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={() => setChainModal(null)}>
                <Text style={s.cancelBtnText}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={saveChainStep}>
                <Text style={s.saveBtnText}>Αποθήκευση</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New medication modal ── */}
      <Modal visible={newMedModal} transparent animationType="fade" onRequestClose={() => setNewMedModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Νέο φάρμακο</Text>

            <Text style={s.formLabel}>Όνομα</Text>
            <TextInput
              style={s.formInput}
              value={newMedForm.name}
              onChangeText={v => setNewMedForm(f => ({ ...f, name: v }))}
              placeholder="π.χ. Αντιβίωση"
              placeholderTextColor="#555"
              autoFocus
            />

            <Text style={s.formLabel}>Δόση / κείμενο ειδοποίησης</Text>
            <TextInput
              style={[s.formInput, { minHeight: 64 }]}
              value={newMedForm.body}
              onChangeText={v => setNewMedForm(f => ({ ...f, body: v }))}
              placeholder="π.χ. 1 δισκίο με νερό"
              placeholderTextColor="#555"
              multiline
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={() => setNewMedModal(false)}>
                <Text style={s.cancelBtnText}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={confirmAddMed}>
                <Text style={s.saveBtnText}>Προσθήκη</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131f' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 48 },

  pageTitle: {
    color: '#cdd6f4',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 8,
  },

  // ── Card ──
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitleInput: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteIcon: { fontSize: 18, marginLeft: 4 },

  // ── Labels ──
  label: {
    color: '#a6adc8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  labelHint: {
    color: '#585b70',
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: '400',
  },
  sublabel: {
    color: '#585b70',
    fontSize: 12,
    marginTop: -4,
  },

  inputDisabled: { opacity: 0.4 },

  // ── Chips ──
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#317181',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipChainOn: { backgroundColor: '#317181' },
  chipChainOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#317181' },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipTextOff: { color: '#317181' },
  chipRemove: { color: '#ffffffcc', fontSize: 18, lineHeight: 18 },
  addChip: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#317181',
  },
  addChipText: { color: '#317181', fontSize: 14, fontWeight: '600' },

  // ── Med step (equal styling for all steps in the chain) ──
  medStep: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  stepNameInput: {
    color: '#cdd6f4',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepBodyInput: {
    color: '#a6adc8',
    fontSize: 14,
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNameStatic: {
    color: '#cdd6f4',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  stepBodyStatic: {
    color: '#a6adc8',
    fontSize: 14,
  },
  tapToEdit: {
    color: '#44475a',
    fontSize: 11,
    marginTop: 2,
  },
  chainStepRemove: { color: '#585b70', fontSize: 22, lineHeight: 24 },

  // ── Chain connector ──
  chainConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  chainLine: { flex: 1, height: 1, backgroundColor: '#2a2a3e' },
  chainDelay: { color: '#585b70', fontSize: 12 },

  addStepBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderStyle: 'dashed',
    marginTop: 2,
  },
  addStepBtnText: { color: '#585b70', fontSize: 13 },

  // ── Add medication button ──
  addMedBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#317181',
    marginBottom: 8,
  },
  addMedBtnText: { color: '#317181', fontSize: 15, fontWeight: '600' },

  // ── Bottom buttons ──
  resetBtn: { alignSelf: 'center', padding: 10, marginVertical: 4 },
  resetBtnText: { color: '#585b70', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#317181',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Modals ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 20,
    width: '88%',
    maxHeight: '85%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  hourRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  hourRowText: { color: '#cdd6f4', fontSize: 16, textAlign: 'center' },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  cancelBtnText: { color: '#585b70', fontSize: 15 },

  formLabel: {
    color: '#a6adc8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#2a2a3e',
    color: '#cdd6f4',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#317181' },
  modalBtnSecondary: { backgroundColor: '#2a2a3e' },
});
