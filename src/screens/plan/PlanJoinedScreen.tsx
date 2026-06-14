import React from 'react';
import { ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { Countdown } from '@/components/atoms/Countdown';
import { FadeUp } from '@/components/atoms/FadeUp';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanJoined'>;

export function PlanJoinedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { detail } = usePlanDetail(route.params?.planId);

  if (!detail) {
    return (
      <Screen scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  const plan = detail.plan;
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <FadeUp duration={400}>
          <IconBox size={72} radius={22} backgroundColor={cat.bg}>
            <Icon name={cat.icon as never} size={34} color={cat.iconColor} strokeWidth={2} />
          </IconBox>
        </FadeUp>
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>You're in!</T.Display></FadeUp>
        <FadeUp duration={400} delay={80}><T.LabelLg style={{ textAlign: 'center', marginBottom: spacing.xs }}>{plan.activity}</T.LabelLg></FadeUp>
        <FadeUp duration={400} delay={100}><T.Meta style={{ textAlign: 'center' }} numberOfLines={1}>{plan.location}</T.Meta></FadeUp>
        <FadeUp duration={400} delay={120} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
          <Countdown startsAt={plan.startsAt} />
        </FadeUp>

        <FadeUp duration={400} delay={150} style={{ width: '100%', marginTop: spacing.xxl }}>
          <Stack gap="sm">
            <Row gap="sm" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2, borderRadius: radii.sm, backgroundColor: colors.surface }}>
              <Icon name="map-pin" size={iconSizes.sm} color={colors.coral} />
              <T.BodyMd color={colors.textSub} style={{ flex: 1 }} numberOfLines={1}>{plan.location}</T.BodyMd>
            </Row>
            <Row gap="sm" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2, borderRadius: radii.sm, backgroundColor: colors.surface }}>
              <Icon name="users" size={iconSizes.sm} color={colors.green} />
              <T.BodyMd color={colors.textSub} style={{ flex: 1 }} numberOfLines={1}>
                {plan.capacity - plan.spotsRemaining} other{plan.capacity - plan.spotsRemaining === 1 ? '' : 's'} joined
              </T.BodyMd>
            </Row>
          </Stack>
        </FadeUp>

        <FadeUp duration={400} delay={200} style={{ width: '100%', marginTop: spacing.xxl }}>
          <Stack gap="sm">
            <Button variant="primary-coral" label="Open group chat" leadingIcon="message-circle" onPress={() => navigation.navigate('Chat', { planId: plan.id })} />
            <Button variant="secondary" label="View plan details" onPress={() => navigation.navigate('Plan', { planId: plan.id })} />
            <Button variant="secondary" label="Back to home" onPress={() => navigation.popToTop()} />
          </Stack>
        </FadeUp>
      </ScreenPad>
    </Screen>
  );
}
