import { useSyncExternalStore } from 'react';
import { I18nManager } from 'react-native';

// The app speaks Greek or English. By default it follows the phone's language
// (a Greek phone gets Greek, any other gets English); Ρυθμίσεις → Γλώσσα can fix
// it to one of the two. Each text is written in place in both languages:
// t('Σήμερα', 'Today').

export type Lang = 'el' | 'en';
export type LangSetting = 'auto' | Lang;

/** The phone's language, without any native module (works in the background too). */
export const deviceLang = (): Lang => {
  const tags: string[] = [];
  try {
    tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {}
  try {
    const id = (I18nManager.getConstants?.() as { localeIdentifier?: string } | undefined)?.localeIdentifier;
    if (id) tags.push(id);
  } catch {}
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') tags.push(navigator.language);
  return (tags.find(Boolean) ?? '').toLowerCase().startsWith('el') ? 'el' : 'en';
};

let current: Lang = deviceLang();
const listeners = new Set<() => void>();

/** Called by the store whenever the data (and so the language setting) is loaded or changes. */
export const setLanguage = (setting: LangSetting | undefined) => {
  const next = setting === 'el' || setting === 'en' ? setting : deviceLang();
  if (next === current) return;
  current = next;
  listeners.forEach(l => l());
};

export const lang = (): Lang => current;

/** The Greek or the English text, for the current language. */
export const t = <T>(el: T, en: T): T => (current === 'en' ? en : el);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Re-renders a component when the language changes (screens that read the data already do). */
export const useLang = (): Lang => useSyncExternalStore(subscribe, lang, lang);
