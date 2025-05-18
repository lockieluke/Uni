import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { userAtom } from '@/lib/states';
import { useAtomValue } from 'jotai';
import TranslateHeader from '@/components/TranslateHeader';

export default function TabLayout() {
  const { signedIn } = useAtomValue(userAtom);
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // headerShown: false,
        tabBarButton: signedIn ? HapticTab :  () => <></>,
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
          headerTitle: ({children}) => (
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
