import { TextStyle, useColorScheme } from 'react-native';

// Mario's colours: cream fur, caramel ears, red bandana.

export const ACCENT = '#9a4e26';

const light = {
  bg: '#fbf5ec',
  card: '#ffffff',
  cardAlt: '#fff8ee',
  border: 'rgba(90,55,25,0.10)',
  input: '#f3e9db',
  text: '#2a1e15',
  textSoft: '#6e5b4b',
  textMuted: '#a08c78',
  accent: ACCENT,
  accentText: '#8a4220',
  accentSoft: 'rgba(154,78,38,0.10)',
  onAccent: '#ffffff',
  success: '#2f855a',
  successStrong: '#2f855a',
  successSoft: 'rgba(47,133,90,0.12)',
  warn: '#b36b00',
  warnSoft: 'rgba(214,150,40,0.16)',
  danger: '#c0362c',
  dangerSoft: 'rgba(192,54,44,0.10)',
  bandana: '#d32f2f',
  overlay: 'rgba(30,18,10,0.45)',
  tabBar: '#ffffff',
};

const dark: typeof light = {
  bg: '#17110c',
  card: '#221a14',
  cardAlt: '#1d1611',
  border: 'rgba(255,235,215,0.08)',
  input: '#2e241c',
  text: '#f5ece2',
  textSoft: '#c9b8a6',
  textMuted: '#8e7c6a',
  accent: '#b8653a',
  accentText: '#f0a97a',
  accentSoft: 'rgba(240,169,122,0.13)',
  onAccent: '#ffffff',
  success: '#7fd49a',
  successStrong: '#2f855a',
  successSoft: 'rgba(127,212,154,0.14)',
  warn: '#f6c26b',
  warnSoft: 'rgba(246,194,107,0.14)',
  danger: '#ff8a80',
  dangerSoft: 'rgba(255,138,128,0.14)',
  bandana: '#ef5350',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: '#1c1510',
};

export type Colors = typeof light;

export const useColors = (): Colors => (useColorScheme() === 'dark' ? dark : light);

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

/**
 * Rounded font for titles and medicine names (loaded in app/_layout.tsx).
 * The file is already extra bold, so the weight stays normal: on Android a
 * bold weight would make it fake-bold a second time.
 */
export const FONT_ROUNDED = 'MarioRounded';
export const rounded: TextStyle = { fontFamily: FONT_ROUNDED, fontWeight: 'normal' };
