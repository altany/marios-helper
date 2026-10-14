import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue } from 'react-native';
import { IconName } from '../../src/ui/components';
import { useColors } from '../../src/ui/theme';

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? on : off} size={24} color={color} />
  );

export default function TabLayout() {
  const c = useColors();
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
      <Tabs.Screen name="index" options={{ title: 'Σήμερα', tabBarIcon: icon('paw', 'paw-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Πρόγραμμα', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="prescription"
        options={{ title: 'Συνταγή', tabBarIcon: icon('medkit', 'medkit-outline') }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Ρυθμίσεις', tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
