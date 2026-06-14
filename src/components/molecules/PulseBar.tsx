import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, letterSpacing } from '@/theme/tokens';
import { LiveDot } from '@/components/atoms/LiveDot';

interface PulseBarProps {
  planCount: number;
  peopleCount: number;
}

export function PulseBar({ planCount, peopleCount }: PulseBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <LiveDot size={6} color={colors.coral} />
      <Text style={[styles.text, { color: colors.text }]}>
        {planCount} PLANS ACTIVE · {peopleCount} PEOPLE OUT TODAY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.screenPx,
    paddingVertical: 7,
    flexShrink: 0,
  },
  text: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    letterSpacing: 0.06 * 11,
  },
});
