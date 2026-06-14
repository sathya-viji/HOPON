/**
 * RolePill — encodes the user's relationship to a plan as a visual badge.
 *
 * 'hosted' uses the sponsored color group (warm, attention-drawing) to signal
 * host responsibility. 'joined' uses the neutral surface to signal membership
 * without prominence. These color choices are product decisions, not arbitrary.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { radii, spacing } from '@/theme/tokens';

interface RolePillProps {
  role: 'hosted' | 'joined';
}

export function RolePill({ role }: RolePillProps) {
  const { colors } = useTheme();
  const bg = role === 'hosted' ? colors.cost.sponsoredBg : colors.surfaceMid;
  const fg = role === 'hosted' ? colors.cost.sponsoredFg : colors.textSub;
  return (
    <View style={{ paddingVertical: spacing.xs / 2, paddingHorizontal: spacing.sm / 2 + 1, borderRadius: radii.xs, backgroundColor: bg }}>
      <Text style={[textStyles.labelXs, { color: fg }]}>{role}</Text>
    </View>
  );
}
