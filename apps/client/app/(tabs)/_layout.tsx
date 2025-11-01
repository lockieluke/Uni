import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme } from 'react-native';

import { HapticTab } from '@/lib/components/HapticTab';
import TranslateHeader from '@/lib/components/TranslateHeader';
import { IconSymbol } from '@/lib/components/ui/IconSymbol';
import TabBarBackground from '@/lib/components/ui/TabBarBackground';
import { Colors } from '@/lib/constants/Colors';
import { userAtom } from '@/lib/states';
import { useAtomValue } from 'jotai';

export default function TabLayout() {
  const { signedIn } = useAtomValue(userAtom);
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // headerShown: false,
        tabBarButton: signedIn ? HapticTab : () => <></>,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          ...Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
            },
            default: {}
          })
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: ({ children }) => (
            <TranslateHeader>{children}</TranslateHeader>
          ),
          title: "Translate",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="translate" color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          headerShown: false
        }}
      />
    </Tabs>
  );
}
