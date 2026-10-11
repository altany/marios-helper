import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { defaultData } from '../model/defaults';
import { migrateV2, normalize, V2_SETTINGS_KEY } from '../model/migrate';
import { AppData } from '../model/types';

// All app data lives in one JSON document in AsyncStorage. Changes go through
// `update`, which runs one at a time so a notification button pressed in the
// background and a tap in the app can't overwrite each other.

const KEY = 'marios-helper/data/v3';

let cache: AppData | null = null;
let loading: Promise<AppData> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(data: AppData) => void>();

const loadFromDisk = async (): Promise<AppData> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return normalize(JSON.parse(raw));

  // First start of this version: bring over the settings of the old app if any.
  const now = Date.now();
  let data = defaultData();
  try {
    const old = await AsyncStorage.getItem(V2_SETTINGS_KEY);
    if (old) data = migrateV2(JSON.parse(old), now);
  } catch (e) {
    console.warn('Could not read old settings, starting fresh', e);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
  return data;
};

export const getData = (): Promise<AppData> => {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = loadFromDisk().then(d => {
      cache = d;
      return d;
    });
    loading.catch(() => (loading = null));
  }
  return loading;
};

const publish = (data: AppData) => listeners.forEach(l => l(data));

/** Applies `recipe` to a copy of the data, saves it and tells every screen. */
export const update = (recipe: (draft: AppData) => void): Promise<AppData> => {
  const job = queue.then(async () => {
    const current = await getData();
    const draft: AppData = JSON.parse(JSON.stringify(current));
    recipe(draft);
    await AsyncStorage.setItem(KEY, JSON.stringify(draft));
    cache = draft;
    publish(draft);
    return draft;
  });
  queue = job.catch(() => undefined);
  return job;
};

/** Replaces everything (used by "Εισαγωγή"). */
export const replaceAll = (data: AppData) => update(draft => Object.assign(draft, normalize(data)));

/** Re-reads from disk, in case a background task changed the data in another JS context. */
export const reload = (): Promise<AppData> => {
  const job = queue.then(async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cache = normalize(JSON.parse(raw));
      publish(cache);
    }
    return getData();
  });
  queue = job.catch(() => undefined);
  return job;
};

export const subscribe = (listener: (data: AppData) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** React hook: the current data, or null while loading. */
export const useData = (): AppData | null => {
  const [data, setData] = useState<AppData | null>(cache);
  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribe(d => alive && setData(d));
    getData().then(d => alive && setData(d));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return data;
};
