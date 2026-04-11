import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChainStep = {
  id: string;
  name: string;
  body: string;
  delayMinutes: number;
};

export type MedicationSchedule = {
  id: string;
  groupTitle?: string;     // display label for the whole chain group
  name: string;
  body: string;
  times: number[];         // scheduled hours (0–23)
  enabled: boolean;
  chainAtHours?: number[]; // hours at which "Το έδωσα" triggers the chain
  chain?: ChainStep[];     // ordered list of follow-up medications
};

// Bumped to v2 — chain is now ChainStep[] instead of a single MedicationChain object.
const SETTINGS_KEY = 'medication_settings_v2';

export const DEFAULT_SETTINGS: MedicationSchedule[] = [
  {
    id: 'hylogel',
    groupTitle: 'Μάτια',
    name: 'Hylogel',
    body: 'Σταγόνες Hylogel - 1 σε κάθε μάτι',
    times: [9, 15, 21],
    enabled: true,
    chainAtHours: [9, 21],
    chain: [
      {
        id: 'lacrimmune',
        name: 'Lacrimmune',
        body: 'Αλοιφή Lacrimmune - 1 κόκκος ρυζιού στο αριστερό και μασάζ',
        delayMinutes: 20,
      },
    ],
  },
  {
    id: 'depon',
    groupTitle: 'Παυσίπονο',
    name: 'Depon',
    body: 'Depon - 1/4 του δισκίου',
    times: [9, 15, 21],
    enabled: true,
  },
];

export const getMedicationSettings = async (): Promise<MedicationSchedule[]> => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored) as MedicationSchedule[];
  } catch (e) {
    console.warn('Failed to load medication settings, using defaults:', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveMedicationSettings = async (settings: MedicationSchedule[]): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
