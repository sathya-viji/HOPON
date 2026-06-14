/**
 * ScreenPad — applies the standard horizontal screen margin (spacing.screenPx).
 *
 * Use this instead of paddingHorizontal: spacing.screenPx on a bare View.
 * It ensures that all screen content aligns to the same horizontal grid,
 * and that the grid value can be changed in one place (tokens.ts) if needed.
 *
 * Additional style props (paddingTop, borderBottom, etc.) can be passed via
 * the style prop — ScreenPad only manages horizontal padding.
 */
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { spacing } from '@/theme/tokens';

interface ScreenPadProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function ScreenPad({ style, children }: ScreenPadProps) {
  return (
    <View style={[{ paddingHorizontal: spacing.screenPx }, style]}>
      {children}
    </View>
  );
}
