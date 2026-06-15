import React from 'react';
import { View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { ReportForm, type ReportReasonOption } from './ReportFormScreen';
import { Icon } from '@/components/atoms/Icon';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { submitReport } from '@/api/safety';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportPlan'>;

const REASONS: ReportReasonOption[] = [
  { label: 'Misleading description', value: 'other' },
  { label: 'Dangerous or unsafe location', value: 'safety_concern' },
  { label: 'Spam or fake plan', value: 'spam' },
  { label: 'Inappropriate content', value: 'inappropriate_content' },
  { label: 'Other', value: 'other' },
];

export function ReportPlanScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const planId = route.params.planId;
  const { detail } = usePlanDetail(planId);
  const plan = detail?.plan;
  const cat = plan ? CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1] : null;

  const contextBlock = plan && cat ? (
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
  ) : null;

  return (
    <ReportForm
      title="Report plan"
      intro="What's the issue with this plan?"
      reasons={REASONS}
      contextBlock={contextBlock}
      onBack={() => navigation.goBack()}
      submit={(reason, notes) => submitReport('plan', planId, reason, notes)}
      onDone={() => navigation.goBack()}
    />
  );
}
