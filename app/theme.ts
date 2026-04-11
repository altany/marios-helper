export const getColors = (scheme: 'light' | 'dark') => ({
  bg:            scheme === 'dark' ? '#13131f' : '#f2f2f7',
  card:          scheme === 'dark' ? '#1e1e2e' : '#ffffff',
  cardBorder:    scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
  inputBg:       scheme === 'dark' ? '#2a2a3e' : '#f0f2f5',
  accent:        '#317181',
  text:          scheme === 'dark' ? '#cdd6f4' : '#1c1c1e',
  textSecondary: scheme === 'dark' ? '#a6adc8' : '#6c6c70',
  textMuted:     scheme === 'dark' ? '#585b70' : '#aeaeb2',
  placeholder:   scheme === 'dark' ? '#555'    : '#aaa',
  danger:        '#ff453a',
  warning:       '#ff9f0a',
  overlay:       'rgba(0,0,0,0.65)',
});
