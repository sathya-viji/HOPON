/**
 * SectionBlock — a padded, optionally bordered content section.
 *
 * Use for distinct content groups within a scrollable screen: a plan's
 * description, a profile's bio, a settings group. Provides consistent
 * horizontal padding (screenPx) and vertical padding, with optional
 * top/bottom border lines to visually separate sections.
 *
 * topBorder defaults to true because the most common use case is a section
 * following another section (separated by a line from above). Set topBorder=false
 * for the first section in a scroll view where no separator is needed.
 */
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, borderWidths } from '@/theme/tokens';

interface SectionBlockProps {
  topBorder?: boolean;
  bottomBorder?: boolean;
  paddingVertical?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function SectionBlock({
  topBorder = true,
  bottomBorder = false,
  paddingVertical = spacing.lg,
  style,
  children,
}: SectionBlockProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.screenPx,
          paddingVertical,
          borderTopWidth: topBorder ? borderWidths.thin : 0,
          borderBottomWidth: bottomBorder ? borderWidths.thin : 0,
          borderTopColor: colors.border,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
