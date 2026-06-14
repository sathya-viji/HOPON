/**
 * PlanStatusPill — encodes a plan's lifecycle stage as a visual badge.
 *
 * 'ongoing' uses the free/green group to signal "live right now".
 * 'upcoming' uses the sponsored/warm group to draw the eye forward.
 * Terminal states (completed/expired/cancelled) use the muted surface.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { radii, spacing } from '@/theme/tokens';
import { Plan } from '@/types';

export type PlanLifecycle = 'upcoming' | 'ongoing' | 'completed' | 'expired' | 'cancelled';

export function planLifecycle(plan: Pick<Plan, 'status' | 'minutesUntilStart'>): PlanLifecycle {
  if (plan.status === 'ended') return 'completed';
  if (plan.status === 'expired') return 'expired';
  if (plan.status === 'cancelled') return 'cancelled';
  return plan.minutesUntilStart <= 0 ? 'ongoing' : 'upcoming';
}

export function PlanStatusPill({ plan }: { plan: Pick<Plan, 'status' | 'minutesUntilStart'> }) {
  const { colors } = useTheme();
  const stage = planLifecycle(plan);
  const palette =
    stage === 'ongoing'
      ? { bg: colors.cost.freeBg, fg: colors.cost.freeFg }
      : stage === 'upcoming'
        ? { bg: colors.cost.sponsoredBg, fg: colors.cost.sponsoredFg }
        : { bg: colors.surfaceMid, fg: colors.textSub };
  return (
    <View style={{ paddingVertical: spacing.xs / 2, paddingHorizontal: spacing.sm / 2 + 1, borderRadius: radii.xs, backgroundColor: palette.bg }}>
      <Text style={[textStyles.labelXs, { color: palette.fg }]}>{stage}</Text>
    </View>
  );
}
