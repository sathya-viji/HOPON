import React, { useState } from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { ConfirmScreen } from '@/components/molecules/ConfirmScreen';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { DestructiveButton } from '@/components/atoms/DestructiveButton';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { cancelPlan } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanCancelConfirm'>;

export function PlanCancelConfirmScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const [busy, setBusy] = useState(false);
  const activity = detail?.plan.activity ?? 'this plan';

  const onCancel = async () => {
    if (!planId || busy) return;
    setBusy(true);
    try {
      await cancelPlan(planId);
      toast.show('Plan cancelled');
      navigation.popToTop();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t cancel the plan. Try again.'));
      setBusy(false);
    }
  };

  return (
    <ConfirmScreen
      onBack={() => navigation.goBack()}
      icon={
        <IconBox backgroundColor={colors.cost.sponsoredBg}>
          <Icon name="alert-triangle" size={28} color={colors.cost.sponsoredFg} />
        </IconBox>
      }
      title="Cancel this plan?"
      sub={<><T.Bold color={colors.text}>{activity}</T.Bold>{' '}will be removed and everyone who joined will be notified.</>}
      notice="This can't be undone."
    >
      <DestructiveButton label={busy ? 'Cancelling…' : 'Yes, cancel plan'} onPress={onCancel} />
      <Button variant="secondary" label="Keep plan" onPress={() => navigation.goBack()} />
    </ConfirmScreen>
  );
}
