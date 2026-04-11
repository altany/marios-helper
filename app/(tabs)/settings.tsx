import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, ActivityIndicator,
  useColorScheme,
} from 'react-native';
import {
  getMedicationSettings, saveMedicationSettings,
  DEFAULT_SETTINGS, MedicationSchedule, ChainStep,
} from '../services/medicationSettings';
import { resetAndRescheduleNotifications } from '../services/notifications';
import { getColors } from '../theme';

const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

type ChainForm = { name: string; body: string; delayMinutes: string };
const emptyChainForm = (): ChainForm => ({ name: '', body: '', delayMinutes: '20' });

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);

  const [settings, setSettings] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addHourFor, setAddHourFor] = useState<string | null>(null);

  const [chainModal, setChainModal] = useState<{ medId: string } | null>(null);
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

  const toggleChainStepHour = (medId: string, stepIndex: number, hour: number) =>
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      const chain = (m.chain ?? []).map((step, i) => {
        if (i !== stepIndex) return step;
        const cur = step.chainAtHours ?? [];
        const updated = cur.includes(hour)
          ? cur.filter(h => h !== hour)
          : [...cur, hour].sort((a, b) => a - b);
        return { ...step, chainAtHours: updated };
      });
      return { ...m, chain };
    }));

  // ── Chain step mutations ──────────────────────────────────────────

  const openAddStep = (medId: string) => {
    setChainModal({ medId });
    setChainForm(emptyChainForm());
  };

  const saveChainStep = () => {
    if (!chainModal || !chainForm.name.trim()) return;
    const { medId } = chainModal;
    const step: ChainStep = {
      id: genId(),
      name: chainForm.name.trim(),
      body: chainForm.body.trim(),
      delayMinutes: Math.max(1, parseInt(chainForm.delayMinutes) || 20),
    };
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      return { ...m, chain: [...(m.chain ?? []), step] };
    }));
    setChainModal(null);
  };

  const updateChainStep = (medId: string, stepIndex: number, field: keyof ChainStep, value: string) =>
    setSettings(prev => prev.map(m => {
      if (m.id !== medId) return m;
      const chain = (m.chain ?? []).map((step, i) => {
        if (i !== stepIndex) return step;
        if (field === 'delayMinutes') return { ...step, delayMinutes: Math.max(1, parseInt(value) || 1) };
        return { ...step, [field]: value };
      });
      return { ...m, chain };
    }));

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
      <View style={[l.fill, l.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  const currentMed = settings.find(m => m.id === addHourFor);
  const availableHours = currentMed
    ? Array.from({ length: 24 }, (_, i) => i).filter(h => !currentMed.times.includes(h))
    : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={l.content}>
      <Text style={[l.pageTitle, { color: c.text }]}>Ρυθμίσεις φαρμάκων</Text>

      {settings.map(med => (
        <View key={med.id} style={[l.card, { backgroundColor: c.card }]}>

          {/* ── Group title + controls ── */}
          <View style={l.cardHeader}>
            <TextInput
              style={[l.groupTitleInput, { backgroundColor: c.inputBg, color: c.text }]}
              value={med.groupTitle ?? ''}
              onChangeText={v => updateField(med.id, 'groupTitle', v)}
              placeholder="Τίτλος ομάδας"
              placeholderTextColor={c.placeholder}
            />
            <Switch
              value={med.enabled}
              onValueChange={() => toggleEnabled(med.id)}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff"
            />
            <TouchableOpacity onPress={() => removeMed(med.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[l.deleteIcon, { color: c.textMuted }]}>🗑</Text>
            </TouchableOpacity>
          </View>

          {/* ── Times ── */}
          <Text style={[l.label, { color: c.textSecondary }]}>Ώρες</Text>
          <View style={l.chipRow}>
            {med.times.map(hour => (
              <View key={hour} style={[l.chip, { backgroundColor: c.accent }]}>
                <Text style={l.chipText}>{formatHour(hour)}</Text>
                <TouchableOpacity onPress={() => removeTime(med.id, hour)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={l.chipRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {med.enabled && (
              <TouchableOpacity style={[l.addChip, { borderColor: c.accent }]} onPress={() => setAddHourFor(med.id)}>
                <Text style={[l.addChipText, { color: c.accent }]}>+ Ώρα</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Chain: all steps with equal styling ── */}
          <Text style={[l.label, { color: c.textSecondary }]}>
            Φάρμακα <Text style={[l.labelHint, { color: c.textMuted }]}>(αλυσίδα)</Text>
          </Text>

          {/* Root medication */}
          <View style={[l.medStep, { backgroundColor: c.inputBg }]}>
            <TextInput
              style={[l.stepNameInput, { backgroundColor: c.card, color: c.text }]}
              value={med.name}
              onChangeText={v => updateField(med.id, 'name', v)}
              placeholder="Όνομα φαρμάκου"
              placeholderTextColor={c.placeholder}
            />
            <TextInput
              style={[l.stepBodyInput, { backgroundColor: c.card, color: c.textSecondary }, !med.enabled && l.inputDisabled]}
              value={med.body}
              onChangeText={v => updateField(med.id, 'body', v)}
              multiline
              editable={med.enabled}
              placeholder="Δόση / κείμενο ειδοποίησης"
              placeholderTextColor={c.placeholder}
            />
          </View>

          {/* Chain hour selector for root */}
          {(med.chain?.length ?? 0) > 0 && med.times.length > 0 && (
            <>
              <Text style={[l.sublabel, { color: c.textMuted }]}>Αλυσίδα ενεργή στις:</Text>
              <View style={l.chipRow}>
                {med.times.map(hour => {
                  const active = med.chainAtHours?.includes(hour) ?? false;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[l.chip, active ? { backgroundColor: c.accent } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.accent }]}
                      onPress={() => toggleChainHour(med.id, hour)}
                    >
                      <Text style={[l.chipText, !active && { color: c.accent }]}>{formatHour(hour)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Chain steps */}
          {(med.chain ?? []).map((step, idx) => (
            <View key={step.id}>
              <View style={l.chainConnector}>
                <View style={[l.chainLine, { backgroundColor: c.border }]} />
                <TextInput
                  style={[l.chainDelayInput, { backgroundColor: c.inputBg, color: c.textSecondary }]}
                  value={String(step.delayMinutes)}
                  onChangeText={v => updateChainStep(med.id, idx, 'delayMinutes', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <Text style={[l.chainDelaySuffix, { color: c.textMuted }]}>λεπτά</Text>
                <View style={[l.chainLine, { backgroundColor: c.border }]} />
                <TouchableOpacity onPress={() => removeChainStep(med.id, idx)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[l.chainStepRemove, { color: c.textMuted }]}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={[l.medStep, { backgroundColor: c.inputBg }]}>
                <TextInput
                  style={[l.stepNameInput, { backgroundColor: c.card, color: c.text }]}
                  value={step.name}
                  onChangeText={v => updateChainStep(med.id, idx, 'name', v)}
                  placeholder="Όνομα φαρμάκου"
                  placeholderTextColor={c.placeholder}
                />
                <TextInput
                  style={[l.stepBodyInput, { backgroundColor: c.card, color: c.textSecondary }]}
                  value={step.body}
                  onChangeText={v => updateChainStep(med.id, idx, 'body', v)}
                  multiline
                  placeholder="Δόση / κείμενο ειδοποίησης"
                  placeholderTextColor={c.placeholder}
                />
              </View>

              {/* Per-step chain hours (only if there's a next step) */}
              {idx < (med.chain?.length ?? 0) - 1 && med.times.length > 0 && (
                <>
                  <Text style={[l.sublabel, { color: c.textMuted }]}>Αλυσίδα ενεργή στις:</Text>
                  <View style={l.chipRow}>
                    {med.times.map(hour => {
                      const active = step.chainAtHours == null || step.chainAtHours.includes(hour);
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[l.chip, active ? { backgroundColor: c.accent } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.accent }]}
                          onPress={() => toggleChainStepHour(med.id, idx, hour)}
                        >
                          <Text style={[l.chipText, !active && { color: c.accent }]}>{formatHour(hour)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          ))}

          <TouchableOpacity style={[l.addStepBtn, { borderColor: c.border }]} onPress={() => openAddStep(med.id)}>
            <Text style={[l.addStepBtnText, { color: c.textMuted }]}>+ Βήμα αλυσίδας</Text>
          </TouchableOpacity>

        </View>
      ))}

      <TouchableOpacity style={[l.addMedBtn, { borderColor: c.accent }]} onPress={() => setNewMedModal(true)}>
        <Text style={[l.addMedBtnText, { color: c.accent }]}>+ Νέο φάρμακο</Text>
      </TouchableOpacity>

      <TouchableOpacity style={l.resetBtn} onPress={resetToDefaults}>
        <Text style={[l.resetBtnText, { color: c.textMuted }]}>Επαναφορά προεπιλογών</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[l.saveBtn, { backgroundColor: c.accent }, saving && l.saveBtnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={l.saveBtnText}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση & Εφαρμογή'}</Text>
      </TouchableOpacity>

      {/* ── Hour picker modal ── */}
      <Modal visible={!!addHourFor} transparent animationType="fade" onRequestClose={() => setAddHourFor(null)}>
        <View style={[l.overlay, { backgroundColor: c.overlay }]}>
          <View style={[l.modalBox, { backgroundColor: c.card }]}>
            <Text style={[l.modalTitle, { color: c.text }]}>Επιλογή ώρας</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {availableHours.map(hour => (
                <TouchableOpacity key={hour} style={[l.hourRow, { borderBottomColor: c.border }]} onPress={() => addHourFor && addTime(addHourFor, hour)}>
                  <Text style={[l.hourRowText, { color: c.text }]}>{formatHour(hour)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={l.cancelBtn} onPress={() => setAddHourFor(null)}>
              <Text style={[l.cancelBtnText, { color: c.textMuted }]}>Άκυρο</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Chain step add modal ── */}
      <Modal visible={!!chainModal} transparent animationType="fade" onRequestClose={() => setChainModal(null)}>
        <View style={[l.overlay, { backgroundColor: c.overlay }]}>
          <View style={[l.modalBox, { backgroundColor: c.card }]}>
            <Text style={[l.modalTitle, { color: c.text }]}>Νέο βήμα αλυσίδας</Text>

            <Text style={[l.formLabel, { color: c.textSecondary }]}>Όνομα φαρμάκου</Text>
            <TextInput
              style={[l.formInput, { backgroundColor: c.inputBg, color: c.text }]}
              value={chainForm.name}
              onChangeText={v => setChainForm(f => ({ ...f, name: v }))}
              placeholder="π.χ. Lacrimmune"
              placeholderTextColor={c.placeholder}
              autoFocus
            />

            <Text style={[l.formLabel, { color: c.textSecondary }]}>Δόση / κείμενο ειδοποίησης</Text>
            <TextInput
              style={[l.formInput, { backgroundColor: c.inputBg, color: c.text, minHeight: 64 }]}
              value={chainForm.body}
              onChangeText={v => setChainForm(f => ({ ...f, body: v }))}
              placeholder="π.χ. 1 κόκκος ρυζιού στο αριστερό μάτι"
              placeholderTextColor={c.placeholder}
              multiline
            />

            <Text style={[l.formLabel, { color: c.textSecondary }]}>Καθυστέρηση (λεπτά μετά το προηγούμενο)</Text>
            <TextInput
              style={[l.formInput, { backgroundColor: c.inputBg, color: c.text }]}
              value={chainForm.delayMinutes}
              onChangeText={v => setChainForm(f => ({ ...f, delayMinutes: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
            />

            <View style={l.modalBtnRow}>
              <TouchableOpacity style={[l.modalBtn, { backgroundColor: c.inputBg }]} onPress={() => setChainModal(null)}>
                <Text style={[l.cancelBtnText, { color: c.textMuted }]}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[l.modalBtn, { backgroundColor: c.accent }]} onPress={saveChainStep}>
                <Text style={l.saveBtnText}>Αποθήκευση</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New medication modal ── */}
      <Modal visible={newMedModal} transparent animationType="fade" onRequestClose={() => setNewMedModal(false)}>
        <View style={[l.overlay, { backgroundColor: c.overlay }]}>
          <View style={[l.modalBox, { backgroundColor: c.card }]}>
            <Text style={[l.modalTitle, { color: c.text }]}>Νέο φάρμακο</Text>

            <Text style={[l.formLabel, { color: c.textSecondary }]}>Όνομα</Text>
            <TextInput
              style={[l.formInput, { backgroundColor: c.inputBg, color: c.text }]}
              value={newMedForm.name}
              onChangeText={v => setNewMedForm(f => ({ ...f, name: v }))}
              placeholder="π.χ. Αντιβίωση"
              placeholderTextColor={c.placeholder}
              autoFocus
            />

            <Text style={[l.formLabel, { color: c.textSecondary }]}>Δόση / κείμενο ειδοποίησης</Text>
            <TextInput
              style={[l.formInput, { backgroundColor: c.inputBg, color: c.text, minHeight: 64 }]}
              value={newMedForm.body}
              onChangeText={v => setNewMedForm(f => ({ ...f, body: v }))}
              placeholder="π.χ. 1 δισκίο με νερό"
              placeholderTextColor={c.placeholder}
              multiline
            />

            <View style={l.modalBtnRow}>
              <TouchableOpacity style={[l.modalBtn, { backgroundColor: c.inputBg }]} onPress={() => setNewMedModal(false)}>
                <Text style={[l.cancelBtnText, { color: c.textMuted }]}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[l.modalBtn, { backgroundColor: c.accent }]} onPress={confirmAddMed}>
                <Text style={l.saveBtnText}>Προσθήκη</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// Layout-only styles (no colors). Colors applied inline via `c`.
const l = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 48 },

  pageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20, marginTop: 8 },

  card: { borderRadius: 12, padding: 16, marginBottom: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitleInput: {
    flex: 1, fontSize: 17, fontWeight: '700',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  deleteIcon: { fontSize: 18, marginLeft: 4 },

  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  labelHint: { fontSize: 11, textTransform: 'none', letterSpacing: 0, fontWeight: '400' },
  sublabel: { fontSize: 12, marginTop: 2 },
  inputDisabled: { opacity: 0.4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipRemove: { color: '#ffffffcc', fontSize: 18, lineHeight: 18 },
  addChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  addChipText: { fontSize: 14, fontWeight: '600' },

  medStep: { borderRadius: 10, padding: 12, gap: 8 },
  stepNameInput: { fontSize: 15, fontWeight: '600', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stepBodyInput: { fontSize: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 52 },

  chainConnector: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  chainLine: { flex: 1, height: 1 },
  chainDelayInput: { fontSize: 13, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 36, textAlign: 'center' },
  chainDelaySuffix: { fontSize: 12 },
  chainStepRemove: { fontSize: 22, lineHeight: 24 },

  addStepBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', marginTop: 2 },
  addStepBtnText: { fontSize: 13 },

  addMedBtn: { borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, marginBottom: 8 },
  addMedBtnText: { fontSize: 15, fontWeight: '600' },

  resetBtn: { alignSelf: 'center', padding: 10, marginVertical: 4 },
  resetBtnText: { fontSize: 13 },
  saveBtn: { borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { borderRadius: 12, padding: 20, width: '88%', maxHeight: '85%' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  hourRow: { paddingVertical: 14, borderBottomWidth: 1 },
  hourRowText: { fontSize: 16, textAlign: 'center' },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  cancelBtnText: { fontSize: 15 },
  formLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  formInput: { borderRadius: 8, padding: 10, fontSize: 14 },
  modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
});
