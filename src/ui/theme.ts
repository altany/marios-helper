import { useColorScheme } from 'react-native';

export const ACCENT = '#317181';

const light = {
  bg: '#f5f3ef',
  card: '#ffffff',
  cardAlt: '#faf9f6',
  border: 'rgba(20,30,35,0.08)',
  input: '#f0eee9',
  text: '#1c2428',
  textSoft: '#56626a',
  textMuted: '#97a1a8',
  accent: ACCENT,
  accentText: '#2a6674',
  accentSoft: 'rgba(49,113,129,0.10)',
  onAccent: '#ffffff',
  success: '#2f855a',
  successStrong: '#2f855a',
  successSoft: 'rgba(47,133,90,0.12)',
  warn: '#b7791f',
  warnSoft: 'rgba(214,158,46,0.16)',
  danger: '#c53030',
  dangerSoft: 'rgba(197,48,48,0.10)',
  overlay: 'rgba(10,15,18,0.45)',
  tabBar: '#ffffff',
};

const dark: typeof light = {
  bg: '#101416',
  card: '#1a2124',
  cardAlt: '#161c1f',
  border: 'rgba(255,255,255,0.08)',
  input: '#232b2f',
  text: '#e9eef0',
  textSoft: '#a9b4ba',
  textMuted: '#6c787f',
  accent: '#3b8a9c',
  accentText: '#79c6d4',
  accentSoft: 'rgba(121,198,212,0.12)',
  onAccent: '#ffffff',
  success: '#68d391',
  successStrong: '#2f855a',
  successSoft: 'rgba(104,211,145,0.14)',
  warn: '#f6c26b',
  warnSoft: 'rgba(246,194,107,0.14)',
  danger: '#fc8181',
  dangerSoft: 'rgba(252,129,129,0.14)',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: '#151b1e',
};

export type Colors = typeof light;

export const useColors = (): Colors => (useColorScheme() === 'dark' ? dark : light);

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
