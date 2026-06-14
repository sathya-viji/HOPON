import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamilies, letterSpacing } from '@/theme/tokens';

interface SpotsBadgeProps {
  remaining: number;
}

export function SpotsBadge({ remaining }: SpotsBadgeProps) {
  const { colors } = useTheme();
  const isFull = remaining <= 0;
  const isCritical = remaining === 1;
  const color = isFull ? colors.textGhost : isCritical ? colors.coral : colors.textDim;
  const label = isFull ? 'FULL' : remaining === 1 ? '1 SPOT' : `${remaining} SPOTS`;

  return <Text style={[styles.text, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
    letterSpacing: letterSpacing.cta * 10,
    textTransform: 'uppercase',
  },
});
