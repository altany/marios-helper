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
};

/** Starting data for a fresh install: Mario's schedule from the previous app version. */
export const defaultData = (now: number): AppData => ({
  version: 3,
  meds: [
    {
      id: 'hylogel',
      name: 'Hylogel',
      kind: 'drops',
      dose: '1 σταγόνα σε κάθε μάτι',
      notes: '',
      color: MED_COLORS[0],
    },
    {
      id: 'lacrimmune',
      name: 'Lacrimmune',
      kind: 'ointment',
      dose: '1 κόκκος ρυζιού στο αριστερό μάτι',
      notes: 'Μετά κάνε απαλό μασάζ στο βλέφαρο.',
      color: MED_COLORS[2],
    },
    {
      id: 'depon',
      name: 'Depon',
      kind: 'pill',
      dose: '1/4 του δισκίου',
      notes: '',
      color: MED_COLORS[4],
    },
  ],
  routines: [
    {
      id: 'eyes-am-pm',
      name: 'Μάτια',
      times: ['09:00', '21:00'],
      days: [],
      steps: [
        { id: 's-hylogel', medId: 'hylogel', waitMin: 0 },
        { id: 's-lacrimmune', medId: 'lacrimmune', waitMin: 20 },
      ],
      enabled: true,
      createdAt: now,
    },
    {
      id: 'eyes-noon',
      name: 'Μάτια (μεσημέρι)',
      times: ['15:00'],
      days: [],
      steps: [{ id: 's-hylogel-noon', medId: 'hylogel', waitMin: 0 }],
      enabled: true,
      createdAt: now,
    },
    {
      id: 'painkiller',
      name: 'Παυσίπονο',
      times: ['09:00', '15:00', '21:00'],
      days: [],
      steps: [{ id: 's-depon', medId: 'depon', waitMin: 0 }],
      enabled: true,
      createdAt: now,
    },
  ],
  runs: {},
  settings: { ...DEFAULT_SETTINGS },
  prescription: { vetName: '', vetPhone: '', notes: '' },
  dismissed: {},
});
