import { AppData, MedKind, Settings } from './types';

export const MED_COLORS = ['#2f8f9d', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

// Icon names are MaterialCommunityIcons.
export const MED_KINDS = [
  { kind: 'drops', label: 'Σταγόνες', icon: 'eyedropper' },
  { kind: 'gel', label: 'Γέλη', icon: 'water' },
  { kind: 'ointment', label: 'Αλοιφή', icon: 'lotion-outline' },
  { kind: 'pill', label: 'Χάπι', icon: 'pill' },
  { kind: 'liquid', label: 'Σιρόπι', icon: 'bottle-tonic-outline' },
  { kind: 'other', label: 'Άλλο', icon: 'bandage' },
] as const satisfies readonly { kind: MedKind; label: string; icon: string }[];

export const kindInfo = (kind: MedKind) => MED_KINDS.find(k => k.kind === kind) ?? MED_KINDS[5];

export const DEFAULT_SETTINGS: Settings = {
  paused: false,
  petName: 'Μάριο',
  snoozeMin: 10,
  repeatMin: 10,
  missAfterMin: 720,
  sticky: true,
  countdown: true,
  insistent: false,
  bark: true,
};

/** A fresh install (or "Σβήσιμο όλων") starts empty: medicines are added from the app. */
export const defaultData = (): AppData => ({
  version: 3,
  meds: [],
  routines: [],
  runs: {},
  settings: { ...DEFAULT_SETTINGS },
  prescription: { vetName: '', vetPhone: '', notes: '' },
  dismissed: {},
});
