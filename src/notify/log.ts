import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { pad } from '../lib/time';

// A short diary of what the notification code did and why: every event from
// Android, every sync, every notification shown (with or without sound),
// scheduled or removed. It is for finding out where an unexpected alert comes
// from. Ρυθμίσεις → «Αρχείο ειδοποιήσεων» shows and shares it.

const KEY = 'marios-helper/notification-log';
const MAX_LINES = 500;

/** Tells apart the starts of the JS code: the open app, or a start in the background by a notification. */
const RUN = Math.random().toString(36).slice(2, 6);

let queue: Promise<unknown> = Promise.resolve();

const stamp = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Clock time with seconds, for alarm times in the log. */
export const clock = (t: number) => stamp(t).slice(6);

export const log = (message: string): Promise<unknown> => {
  const line = `${stamp(Date.now())} [${RUN}] ${message}`;
  queue = queue
    .then(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      const lines: string[] = raw ? JSON.parse(raw) : [];
      lines.push(line);
      await AsyncStorage.setItem(KEY, JSON.stringify(lines.slice(-MAX_LINES)));
    })
    .catch(() => undefined);
  return queue;
};

export const readLog = async (): Promise<string[]> => {
  await queue;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearLog = async () => {
  await queue;
  await AsyncStorage.removeItem(KEY);
};

/** Called once when the JS code starts (with the app, or in the background). */
export const logStart = () => log(`JS started (app state: ${AppState.currentState ?? 'unknown'})`);
