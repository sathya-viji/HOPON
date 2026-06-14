/**
 * RootNavigator — the top-level navigation container.
 *
 * Wires the React Navigation theme to the app's design tokens so that
 * navigator-rendered chrome (background, card, border) matches the active
 * color mode without any screen-level overrides.
 *
 * The top-level stack is driven by auth state (useAuth):
 *   'loading'    → a spinner while the session is checked on cold boot
 *   'onboarding' → Onboarding stack (no session, or signed in without a profile)
 *   'ready'      → Main (signed in + profile complete)
 * Switching status swaps the stack (the standard React Navigation auth pattern).
 *
 * navigationRef is exported for imperative navigation from outside the React
 * tree (future push notification handlers, deep links).
 */
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@/theme';
import { useAuth } from '@/state/AuthContext';
import type { RootStackParamList } from './types';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainNavigator } from './MainNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { mode, colors } = useTheme();
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: mode === 'dark',
        colors: {
          primary: colors.coral,
          background: colors.bg,
          card: colors.bg,
          text: colors.text,
          border: colors.border,
          notification: colors.coral,
        },
        fonts: {
          regular: { fontFamily: 'Inter-Regular', fontWeight: '400' },
          medium: { fontFamily: 'Inter-Medium', fontWeight: '500' },
          bold: { fontFamily: 'Inter-Bold', fontWeight: '700' },
          heavy: { fontFamily: 'Inter-Black', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'ready' ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
