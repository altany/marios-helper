import { sortTimes, pad } from '../lib/time';
import { DEFAULT_SETTINGS, MED_COLORS } from './defaults';
import { AppData, Medication, Routine } from './types';

// Shape saved by the previous version of the app (AsyncStorage key 'medication_settings_v2').
interface V2ChainStep {
  id: string;
  name: string;
  body: string;
  delayMinutes: number;
  chainAtHours?: number[];
}
interface V2Schedule {
  id: string;
  groupTitle?: string;
  name: string;
  body: string;
  times: number[];
  enabled: boolean;
  chainAtHours?: number[];
  chain?: V2ChainStep[];
}

export const V2_SETTINGS_KEY = 'medication_settings_v2';

/** How many chain steps run after the first medicine at this hour (old "chainAtHours" rules). */
const chainDepthAt = (s: V2Schedule, hour: number): number => {
  const chain = s.chain ?? [];
  if (chain.length === 0 || !(s.chainAtHours ?? []).includes(hour)) return 0;
  let depth = 1;
  while (depth < chain.length) {
    const prev = chain[depth - 1];
    if (prev.chainAtHours != null && !prev.chainAtHours.includes(hour)) break;
    depth++;
  }
  return depth;
};

/**
 * Turns the old per-medicine schedule into medicines + routines. Hours that ran
 * a different part of the chain become separate routines, e.g. Hylogel at 9/15/21
 * with Lacrimmune only after 9 and 21 → "Hylogel → Lacrimmune" at 09:00, 21:00
 * and "Hylogel" at 15:00.
 */
export const migrateV2 = (old: V2Schedule[], now: number): AppData => {
  const meds: Medication[] = [];
  const medIdByName = new Map<string, string>();

  const medFor = (id: string, name: string, body: string): string => {
    const key = name.trim().toLowerCase();
    const existing = medIdByName.get(key);
    if (existing) return existing;
    const medId = meds.some(m => m.id === id) ? `${id}-${meds.length}` : id;
    meds.push({
      id: medId,
      name: name.trim() || 'Φάρμακο',
      kind: 'other',
      dose: body.trim(),
      notes: '',
      color: MED_COLORS[meds.length % MED_COLORS.length],
    });
    medIdByName.set(key, medId);
    return medId;
  };

  const routines: Routine[] = [];
  for (const s of old) {
    const rootMed = medFor(s.id, s.name, s.body);
    const chainMeds = (s.chain ?? []).map(c => medFor(c.id, c.name, c.body));

    const hoursByDepth = new Map<number, number[]>();
    for (const hour of s.times) {
      const depth = chainDepthAt(s, hour);
      hoursByDepth.set(depth, [...(hoursByDepth.get(depth) ?? []), hour]);
    }
    if (hoursByDepth.size === 0) hoursByDepth.set((s.chain ?? []).length, []);

    const depths = Array.from(hoursByDepth.keys()).sort((a, b) => b - a);
    depths.forEach((depth, i) => {
      const title = s.groupTitle?.trim() || s.name;
      routines.push({
        id: i === 0 ? s.id : `${s.id}-${depth}`,
        name: depths.length > 1 && i > 0 ? `${title} (${s.name})` : title,
        times: sortTimes((hoursByDepth.get(depth) ?? []).map(h => `${pad(h)}:00`)),
        days: [],
        steps: [
          { id: `${s.id}-root`, medId: rootMed, waitMin: 0 },
          ...(s.chain ?? []).slice(0, depth).map((c, idx) => ({
            id: `${s.id}-${c.id}`,
            medId: chainMeds[idx],
            waitMin: Math.max(1, c.delayMinutes || 20),
          })),
        ],
        enabled: s.enabled,
        createdAt: now,
      });
    });
  }

  return {
    version: 3,
    meds,
    routines,
    runs: {},
    settings: { ...DEFAULT_SETTINGS },
    prescription: { vetName: '', vetPhone: '', notes: '' },
    dismissed: {},
  };
};

/** Fills in fields added in later versions so older saved data keeps working. */
export const normalize = (data: AppData): AppData => ({
  ...data,
  version: 3,
  meds: data.meds ?? [],
  routines: (data.routines ?? []).map(r => ({ ...r, days: r.days ?? [], times: sortTimes(r.times ?? []) })),
  runs: data.runs ?? {},
  settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  prescription: { ...{ vetName: '', vetPhone: '', notes: '' }, ...data.prescription },
  dismissed: data.dismissed ?? {},
});
