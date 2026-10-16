import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue } from 'react-native';
import { t, useLang } from '../../src/i18n';
import { IconName } from '../../src/ui/components';
import { useColors } from '../../src/ui/theme';

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? on : off} size={24} color={color} />
  );

export default function TabLayout() {
  const c = useColors();
  useLang(); // tab names follow the language
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('Σήμερα', 'Today'), tabBarIcon: icon('paw', 'paw-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: t('Πρόγραμμα', 'Schedule'), tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="prescription"
        options={{ title: t('Συνταγή', 'Prescription'), tabBarIcon: icon('medkit', 'medkit-outline') }}
      />
      <Tabs.Screen name="settings" options={{ title: t('Ρυθμίσεις', 'Settings'), tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
