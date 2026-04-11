import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { getColors } from '../theme';

export default function TabLayout() {
  const scheme = useColorScheme() ?? 'dark';
  const c = getColors(scheme);

  return (
    <Tabs
      initialRouteName="notifications"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.cardBorder,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Ειδοποιήσεις',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ρυθμίσεις',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="instructions"
        options={{
          title: 'Οδηγίες',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'document-text' : 'document-text-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
