import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notifee from '../src/notify/driver';
import { handleEvent, requestPrompt } from '../src/notify/events';
import { setupNotifications } from '../src/notify/health';
import { syncNotifications } from '../src/notify/sync';
import { reload } from '../src/store/store';
import { DosePrompt } from '../src/ui/DosePrompt';
import { useColors } from '../src/ui/theme';
import { ToastHost } from '../src/ui/toast';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();

  useEffect(() => {
    setupNotifications()
      .then(() => notifee.getInitialNotification())
      .then(initial => {
        // App opened by tapping a medicine notification → show that medicine.
        const data = initial?.notification.data;
        if (typeof data?.runId === 'string') requestPrompt({ runId: data.runId, index: Number(data.index) });
      })
      .catch(e => console.warn('Setup failed', e));

    const unsubscribe = notifee.onForegroundEvent(event => handleEvent(event, true));

    // Coming back to the app: pick up changes made from the notification
    // buttons while it was in the background, and refresh the alarms.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') reload().then(syncNotifications);
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.bg, card: c.card, primary: c.accent } }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="routine/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="med/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="history" />
        </Stack>
        <DosePrompt />
        <ToastHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
