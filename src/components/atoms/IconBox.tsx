/**
 * IconBox — centred-icon hero container for state and confirmation screens.
 *
 * Used at the top of screens like PlanPostedScreen, PlanApprovedScreen,
 * RecapPostedScreen — screens that communicate a single outcome and need a
 * prominent visual anchor. The built-in marginBottom keeps the icon consistently
 * spaced from the heading below it without each screen needing to manage that gap.
 *
 * Not a generic container. If you need a small icon in a row or card, use
 * a plain View with the category bg color — IconBox is sized and margined
 * specifically for hero use.
 */
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme';
import { radii, borderWidths, spacing } from '@/theme/tokens';

interface IconBoxProps {
  size?: number;
  radius?: number;
  backgroundColor?: string;
  borderColor?: string;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function IconBox({
  size = 64,
  radius = radii.xxl,
  backgroundColor,
  borderColor,
  bordered = false,
  style,
  children,
}: IconBoxProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          backgroundColor: backgroundColor ?? colors.surface,
          borderWidth: bordered ? borderWidths.medium : 0,
          borderColor: borderColor ?? colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
