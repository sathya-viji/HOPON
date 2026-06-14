import React from 'react';
import { View, Pressable } from 'react-native';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { Icon, IconName } from '@/components/atoms/Icon';
import { PlanStatusPill } from '@/components/atoms/PlanStatusPill';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { Plan } from '@/types';

interface PlanHistoryRowProps {
  plan: Pick<Plan, 'activity' | 'location' | 'categoryId' | 'status' | 'minutesUntilStart'>;
  onPress: () => void;
}

export function PlanHistoryRow({ plan, onPress }: PlanHistoryRowProps) {
  const { colors } = useTheme();
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId)!;
  return (
    <Pressable
      onPress={onPress}
      style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
    >
      <Row gap="md" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.screenPx }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
          <Icon name={cat.icon as IconName} size={iconSizes.md} color={cat.iconColor} strokeWidth={2} />
        </View>
        <Stack style={{ flex: 1, minWidth: 0 }}>
          <T.LabelLg numberOfLines={1}>{plan.activity}</T.LabelLg>
          <T.Meta numberOfLines={1}>{plan.location}</T.Meta>
        </Stack>
        <PlanStatusPill plan={plan} />
      </Row>
    </Pressable>
  );
}
