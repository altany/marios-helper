import { t } from '../i18n';
import { AppData, MedKind, Settings } from './types';

export const MED_COLORS = ['#2f8f9d', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

// Icon names are MaterialCommunityIcons.
export const MED_KINDS = [
  { kind: 'drops', get label() { return t('Σταγόνες', 'Drops'); }, icon: 'eyedropper' },
  { kind: 'gel', get label() { return t('Γέλη', 'Gel'); }, icon: 'water' },
  { kind: 'ointment', get label() { return t('Αλοιφή', 'Ointment'); }, icon: 'lotion-outline' },
  { kind: 'pill', get label() { return t('Χάπι', 'Pill'); }, icon: 'pill' },
  { kind: 'liquid', get label() { return t('Σιρόπι', 'Syrup'); }, icon: 'bottle-tonic-outline' },
  { kind: 'other', get label() { return t('Άλλο', 'Other'); }, icon: 'bandage' },
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
  language: 'auto',
};

/** A fresh install (or "Σβήσιμο όλων") starts empty: medicines are added from the app. */
export const defaultData = (): AppData => ({
  version: 3,
  meds: [],
  routines: [],
  runs: {},
  settings: { ...DEFAULT_SETTINGS, petName: t('Μάριο', 'Mario') },
  prescription: { vetName: '', vetPhone: '', notes: '' },
  dismissed: {},
});
