import React, { useState } from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { ConfirmScreen } from '@/components/molecules/ConfirmScreen';
import { Button } from '@/components/atoms/Button';
import { IconBox } from '@/components/atoms/IconBox';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { leavePlan } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanLeaveConfirm'>;

export function PlanLeaveConfirmScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const [busy, setBusy] = useState(false);
  const activity = detail?.plan.activity ?? 'this plan';

  const onLeave = async () => {
    if (!planId || busy) return;
    setBusy(true);
    try {
      await leavePlan(planId);
      toast.show('Left plan');
      navigation.popToTop();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t leave the plan. Try again.'));
      setBusy(false);
    }
  };

  return (
    <ConfirmScreen
      onBack={() => navigation.goBack()}
      icon={<IconBox bordered><T.Heading>🚪</T.Heading></IconBox>}
      title="Leave this plan?"
      sub={<>You'll lose your spot in <T.Bold color={colors.text}>{activity}</T.Bold>. If it fills up you won't be able to rejoin.</>}
    >
      <Button variant="primary" label={busy ? 'Leaving…' : 'Yes, leave plan'} onPress={onLeave} disabled={busy} />
      <Button variant="secondary" label="Stay in" onPress={() => navigation.goBack()} />
    </ConfirmScreen>
  );
}
