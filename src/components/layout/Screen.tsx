/**
 * Screen — the root shell for every screen in the app.
 *
 * Handles safe area insets, keyboard avoidance, header/footer slots, and
 * background color. Every screen file must use this as its outermost component.
 *
 * Header and footer are rendered outside the scroll container so they remain
 * fixed while content scrolls. The scroll body automatically pads the bottom
 * to account for the home indicator when no footer is present.
 *
 * Use `scroll={false}` for screens that manage their own scroll container
 * (FlatList screens, map screens). Use `keyboardAware={false}` only when the
 * screen has its own keyboard handling (e.g. full-screen chat with a custom
 * input bar pinned by KeyboardAvoidingView).
 */
import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTheme } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  backgroundColor?: string;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  keyboardAware = true,
  backgroundColor,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bg = backgroundColor ?? colors.bg;

  // When a visible tab bar sits below this screen it already clears the
  // system inset; only full-bleed screens (no tab bar, or tab bar hidden)
  // need to pad for the home indicator / Android nav bar themselves.
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const bottomInset = tabBarHeight > 0 ? 0 : insets.bottom;

  const bottomPad = footer ? 0 : bottomInset + 16;

  const body = scroll ? (
    keyboardAware ? (
      <KeyboardAwareScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {children}
      </ScrollView>
    )
  ) : (
    <View style={[styles.body, { paddingBottom: footer ? 0 : bottomInset }]}>{children}</View>
  );

  const inner = (
    <>
      {header && (
        <View style={[styles.headerSlot, { paddingTop: insets.top }]}>{header}</View>
      )}
      {!header && <View style={{ height: insets.top }} />}
      {body}
      {footer && (
        <View style={[styles.footerSlot, { paddingBottom: bottomInset }]}>{footer}</View>
      )}
    </>
  );

  if (footer) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  headerSlot: { flexShrink: 0, zIndex: 10 },
  body: { flex: 1 },
  footerSlot: { flexShrink: 0, zIndex: 10 },
});
