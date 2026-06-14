import React from 'react';
import { View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { ReportForm } from './ReportFormScreen';
import { Icon } from '@/components/atoms/Icon';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, CATEGORIES } from '@/theme/tokens';
import { plans, getPlanById } from '@/mocks';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportPlan'>;

const REASONS = ['Misleading description', 'Dangerous or unsafe location', 'Spam or fake plan', 'Inappropriate content', 'Other'];

export function ReportPlanScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const plan = getPlanById(route.params?.planId) ?? plans[0];
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId)!;

  const contextBlock = (
    <Row
      gap="sm"
      style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2, borderWidth: borderWidths.thin, borderRadius: radii.sm, marginBottom: spacing.lg, backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <View style={{ width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
        <Icon name={cat.icon as never} size={iconSizes.md} color={cat.iconColor} strokeWidth={2} />
      </View>
      <Stack gap={2}>
        <T.LabelMd>{plan.activity}</T.LabelMd>
        <T.Meta>{plan.location}</T.Meta>
      </Stack>
    </Row>
  );

  return (
    <ReportForm
      title="Report plan"
      intro="What's the issue with this plan?"
      reasons={REASONS}
      contextBlock={contextBlock}
      onBack={() => navigation.goBack()}
      onSubmit={() => navigation.goBack()}
    />
  );
}
