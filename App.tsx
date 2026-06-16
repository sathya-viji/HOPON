import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Text, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '@/theme';
import { startAuthAutoRefresh } from '@/api/client';
import { configurePushHandler } from '@/services/push';
import { AuthProvider, useAuth } from '@/state/AuthContext';
import { SessionProvider } from '@/state/SessionContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastContainer } from '@/components/atoms/Toast';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { useSuspended } from '@/state/suspension';
import { signOut } from '@/api/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Refresh auth tokens while the app is foregrounded (paused when backgrounded).
startAuthAutoRefresh();

// Notification display behaviour + Android channel (guarded; no-ops on simulator).
void configurePushHandler();

const splash = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
});

// Follows the in-app theme toggle, not just the OS scheme, so the clock and
// battery stay legible when dark mode is switched from Settings.
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

// Rendered inside ThemeProvider + AuthProvider so it can read theme + trigger auth refresh on logout.
function SuspensionOverlay() {
  const isSuspended = useSuspended();
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!isSuspended) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await signOut(); } catch { /* best-effort */ }
    await refresh();
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: '100%', borderRadius: 20, padding: 28, backgroundColor: colors.bg }}>
          <Text style={{ fontFamily: 'Inter-Black', fontSize: 22, color: colors.text, marginBottom: 12 }}>
            Account suspended
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 24, color: colors.textSub, marginBottom: 8 }}>
            Your account has been temporarily suspended due to a violation of our community guidelines.
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 24, color: colors.textSub, marginBottom: 28 }}>
            If you think this is a mistake, email us at{' '}
            <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.coral }}>support@hopon.app</Text>
          </Text>
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.coral }}
          >
            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 15, color: '#fff' }}>
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
    'Inter-Black': Inter_900Black,
  });
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
      setTimeout(() => setShowSplash(false), 500);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || showSplash) {
    return (
      <View style={splash.container}>
        <StatusBar style="light" />
        <Svg width={160} height={38} viewBox="0 0 420.17 98.11" accessibilityLabel="HopOn">
          <Path fill="#ffffff" d="M364.12.84l29.64,54.74V.84h26.4v97.26h-30.89l-29.64-54.73v54.73h-26.4V.84h30.89Z" />
          <Path fill="#f0492d" d="M340.57,16.69c32.45,47.18-61.77,112.18-94.34,65.08-32.45-47.18,61.77-112.18,94.34-65.08ZM320.69,30.41c-14.46-21.21-69.26,16.61-54.57,37.64,14.46,21.21,69.26-16.61,54.57-37.64Z" />
          <Path fill="#ffffff" d="M219.47.62h-44.29v8.43c-22.52-19.55-61.57-4.84-81.71,19.67V.62h-28.69v35.81H28.69V.62H0v97.26h28.69v-37.58h36.08v37.58h28.69v-9.51c22.33,19.91,61.36,5.47,81.71-18.91v28.42h28.69v-24.15h15.6c23.87,0,42.59-10.58,42.59-36.56S243.34.62,219.47.62ZM107.22,67.7c-14.69-21.04,40.11-58.85,54.57-37.64,14.69,21.04-40.11,58.85-54.57,37.64ZM219.47,49.79h-15.6v-25.23h15.6c8.34,0,13.63,3.93,13.63,12.62s-5.29,12.62-13.63,12.62Z" />
        </Svg>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
                <SessionProvider>
                  <ThemedStatusBar />
                  <RootNavigator />
                  <ToastContainer />
                  <SuspensionOverlay />
                </SessionProvider>
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
