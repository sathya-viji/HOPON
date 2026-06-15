import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { Countdown } from '@/components/atoms/Countdown';
import { FadeUp } from '@/components/atoms/FadeUp';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, iconSizes } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanApproved'>;

export function PlanApprovedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const plan = detail?.plan;

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <FadeUp duration={400}>
          <IconBox size={72} radius={22} backgroundColor={colors.cost.freeBg}>
            <Icon name="badge-check" size={36} color={colors.green} />
          </IconBox>
        </FadeUp>
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>You're approved!</T.Display></FadeUp>
        {plan ? (
          <>
            <FadeUp duration={400} delay={80}><T.LabelLg style={{ textAlign: 'center', marginBottom: spacing.xs }}>{plan.activity}</T.LabelLg></FadeUp>
            <FadeUp duration={400} delay={100}><T.Meta style={{ textAlign: 'center' }}>{plan.location}</T.Meta></FadeUp>
            <FadeUp duration={400} delay={120} style={{ alignSelf: 'center', marginTop: spacing.lg - 2, marginBottom: spacing.xxl + spacing.sm }}>
              <Countdown startsAt={plan.startsAt} />
            </FadeUp>
          </>
        ) : null}
        <FadeUp duration={400} delay={180} style={{ width: '100%' }}>
          <Stack gap="sm">
            <Button variant="primary-coral" label="Open group chat" leadingIcon="message-circle" onPress={() => planId && navigation.navigate('Chat', { planId })} />
            <Button variant="secondary" label="View plan details" onPress={() => planId && navigation.replace('Plan', { planId })} />
          </Stack>
        </FadeUp>
      </ScreenPad>
    </Screen>
  );
}
