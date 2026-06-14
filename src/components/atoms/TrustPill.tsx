import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';

interface TrustPillProps {
  label: string;
  tone?: 'default' | 'green';
}

export function TrustPill({ label, tone = 'default' }: TrustPillProps) {
  const { colors } = useTheme();
  const isGreen = tone === 'green';
  const bg = isGreen ? colors.cost.freeBg : colors.surfaceMid;
  const fg = isGreen ? colors.cost.freeFg : colors.textSub;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.semibold,
  },
});
