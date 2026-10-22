import React from 'react';
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { F } from '@/components/ui';
import colorsConst from '@/constants/colors';

const C = colorsConst.light;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.mutedForeground,
        tabBarLabelStyle: { fontFamily: F.s, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: C.background,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          ...(Platform.OS === 'web' ? { height: 84 } : {}),
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Clients', tabBarButtonTestID: 'tab-clients', tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} /> }} />
      <Tabs.Screen name="collections" options={{ title: 'Encaissé', tabBarButtonTestID: 'tab-collections', tabBarIcon: ({ color }) => <Feather name="download" size={22} color={color} /> }} />
      <Tabs.Screen name="reminders" options={{ title: 'Relances', tabBarButtonTestID: 'tab-reminders', tabBarIcon: ({ color }) => <Feather name="bell" size={22} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarButtonTestID: 'tab-settings', tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} /> }} />
    </Tabs>
  );
}
