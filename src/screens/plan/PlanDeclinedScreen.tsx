import React from 'react';
import { Text } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { IconBox } from '@/components/atoms/IconBox';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { plans, getPlanById, getUserById } from '@/mocks';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanDeclined'>;

export function PlanDeclinedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const plan = getPlanById(route.params?.planId) ?? plans[1];
  const hostFirst = getUserById(plan.hostId)?.name.split(' ')[0] ?? 'The host';

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <IconBox size={72} radius={22} bordered>
          <Text style={{ fontSize: 36 }}>😔</Text>
        </IconBox>
        <T.Heading style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Not this time.</T.Heading>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxl + spacing.sm }}>
          {hostFirst} couldn't fit you in for{' '}
          <T.Bold color={colors.text}>{plan.activity}</T.Bold>. Nothing personal — plans fill fast.
        </T.BodyLg>
        <Stack gap="sm" style={{ width: '100%' }}>
          <Button variant="primary-coral" label="See other plans nearby" onPress={() => navigation.popToTop()} />
          <Button variant="secondary" label="Back" onPress={() => navigation.goBack()} />
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
