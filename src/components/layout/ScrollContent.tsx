/**
 * ScrollContent — a pre-configured ScrollView for horizontal chip/card rows.
 *
 * Uses react-native-gesture-handler's ScrollView (not RN's) so it works
 * correctly inside gesture responders without touch conflicts. Applies
 * screenPx horizontal padding and a token-based gap between items.
 *
 * Primarily used for: category chip rows, story bubble rows, filter pill rows.
 * For vertical scrolling, use Screen's built-in scroll or a bare FlatList.
 */
import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { spacing } from '@/theme/tokens';

interface ScrollContentProps {
  horizontal?: boolean;
  gap?: number;
  paddingBottom?: number;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function ScrollContent({ horizontal, gap, paddingBottom, contentStyle, children }: ScrollContentProps) {
  return (
    <ScrollView
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        {
          paddingHorizontal: spacing.screenPx,
          gap: gap ?? spacing.md,
          paddingBottom: paddingBottom ?? spacing.xs,
        },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
