import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanExpired'>;

export function PlanExpiredScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { detail } = usePlanDetail(route.params?.planId);
  const plan = detail?.plan;
  const cat = CATEGORIES.find((c) => c.id === plan?.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];

  const header = (
    <ScreenPad>
      <Row style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header} scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <IconBox size={64} radius={20} backgroundColor={cat.bg} style={{ marginBottom: spacing.md }}>
          <Icon name={cat.icon as never} size={28} color={cat.iconColor} strokeWidth={2} />
        </IconBox>
        <T.Subheading style={{ marginBottom: spacing.xs, textAlign: 'center' }}>{plan?.activity ?? 'This plan'}</T.Subheading>
        <T.Meta style={{ marginBottom: spacing.sm }}>{plan?.location ?? ''}</T.Meta>
        <Row gap="sm" style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.lg - 2, borderRadius: radii.full, marginBottom: spacing.xxxl, backgroundColor: colors.surface }}>
          <Icon name="clock" size={iconSizes.xxs + 3} color={colors.textDim} />
          <T.Semibold color={colors.textDim}>This plan has passed</T.Semibold>
        </Row>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
          Did you make it? Post a recap to share the moment with your neighbourhood.
        </T.BodyLg>
        <Stack gap="sm" style={{ width: '100%' }}>
          <Button variant="primary-coral" label="Post a recap" onPress={() => navigation.getParent()?.navigate('RecapsTab' as never)} />
          <Button variant="secondary" label="Back to home" onPress={() => navigation.popToTop()} />
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
