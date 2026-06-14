import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CostType } from '@/types';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';
import { getCostLabel } from '@/utils/plan';

interface CostTagProps {
  type: CostType;
  note?: string;
}

export function CostTag({ type, note }: CostTagProps) {
  const { colors } = useTheme();
  const palette = {
    free: { bg: colors.cost.freeBg, fg: colors.cost.freeFg },
    copay: { bg: colors.cost.copayBg, fg: colors.cost.copayFg },
    sponsored: { bg: colors.cost.sponsoredBg, fg: colors.cost.sponsoredFg },
    seeking: { bg: colors.cost.seekingBg, fg: colors.cost.seekingFg },
  }[type];

  return (
    <View style={[styles.tag, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>
        {getCostLabel(type, note)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.semibold,
  },
});
