import { DEFAULT_SETTINGS, MED_COLORS } from '../src/model/defaults';
import { AppData } from '../src/model/types';

/** Sample schedule for tests (Mario's medicines in October 2026). */
export const sampleData = (now: number): AppData => ({
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
