import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

interface OnboardingProgressProps {
  step: number;
  total?: number;
}

export function OnboardingProgress({ step, total = 6 }: OnboardingProgressProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: i < step ? colors.text : colors.borderMid },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.screenPx,
    paddingTop: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
});
