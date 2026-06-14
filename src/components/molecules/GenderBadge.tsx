import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';
import { GenderPref } from '@/types';

interface GenderBadgeProps {
  pref: GenderPref;
}

export function GenderBadge({ pref }: GenderBadgeProps) {
  const { colors } = useTheme();
  if (pref === 'all') return null;
  const palette =
    pref === 'women'
      ? { bg: colors.gender.womenBg, fg: colors.gender.womenFg, label: 'Women only' }
      : { bg: colors.gender.menBg, fg: colors.gender.menFg, label: 'Men only' };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{palette.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
  },
});
