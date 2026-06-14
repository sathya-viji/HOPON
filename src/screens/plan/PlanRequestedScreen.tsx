import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { Countdown } from '@/components/atoms/Countdown';
import { FadeUp } from '@/components/atoms/FadeUp';
import { TrustGrid } from '@/components/molecules/TrustGrid';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, borderWidths, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { leavePlan } from '@/api/plans';
import { getMyProfile } from '@/api/users';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { User } from '@/types';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanRequested'>;

export function PlanRequestedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const [me, setMe] = useState<User | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => { getMyProfile().then(setMe).catch(() => setMe(null)); }, []);

  const onWithdraw = async () => {
    if (!planId || withdrawing) return;
    setWithdrawing(true);
    try {
      await leavePlan(planId);
      toast.show('Request withdrawn');
      navigation.popToTop();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t withdraw the request.'));
      setWithdrawing(false);
    }
  };

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
  const host = detail.host;
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
  const hostFirstName = host?.name.split(' ')[0] ?? 'the host';

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <FadeUp duration={400}>
          <IconBox size={72} radius={22} backgroundColor={colors.cost.copayBg} style={{ marginBottom: spacing.lg + 4 }}>
            <Icon name="clock" size={34} color={colors.cost.copayFg} />
          </IconBox>
        </FadeUp>
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Request sent</T.Display></FadeUp>
        <FadeUp duration={400} delay={100}>
          <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260 }}>
            <T.Bold color={colors.text}>{hostFirstName}</T.Bold> will review your request and let you know.
          </T.BodyLg>
        </FadeUp>

        <FadeUp duration={400} delay={120} style={{ marginTop: spacing.lg + 4 }}>
          <Row gap="sm" style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg - 2, borderRadius: radii.full, borderWidth: borderWidths.thin, backgroundColor: colors.surface, borderColor: colors.border }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
              <Icon name={cat.icon as never} size={iconSizes.xxs + 2} color={cat.iconColor} strokeWidth={2} />
            </View>
            <T.LabelSm numberOfLines={1}>{plan.activity}</T.LabelSm>
            <Countdown startsAt={plan.startsAt} />
          </Row>
        </FadeUp>

        {me ? (
          <FadeUp duration={400} delay={140} style={{ width: '100%' }}>
            <TrustGrid
              hosted={me.plansHosted}
              joined={me.plansAttended}
              attendance={me.attendanceScore}
              met={me.peopleMet}
            />
          </FadeUp>
        ) : null}
        <FadeUp duration={400} delay={160}>
          <T.MetaXs style={{ textAlign: 'center', marginTop: spacing.sm }}>Your trust stats above are visible to {hostFirstName}.</T.MetaXs>
        </FadeUp>

        {canceling ? (
          <FadeUp duration={200} style={{ width: '100%', marginTop: spacing.md }}>
            <Stack gap="sm" style={{ padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.cost.sponsoredBg }}>
              <T.LabelMd color={colors.cost.sponsoredFg}>Withdraw request?</T.LabelMd>
              <T.Meta color={colors.cost.sponsoredFg}>
                You'll lose your place in the queue. If the plan fills up you may not get another spot.
              </T.Meta>
              <Row gap="sm">
                <Pressable
                  onPress={onWithdraw}
                  disabled={withdrawing}
                  style={{ flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radii.sm, alignItems: 'center', backgroundColor: colors.cost.sponsoredFg }}
                >
                  <T.LabelSm color={colors.white}>{withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}</T.LabelSm>
                </Pressable>
                <Pressable
                  onPress={() => setCanceling(false)}
                  style={{ flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radii.sm, alignItems: 'center', borderWidth: borderWidths.medium, borderColor: colors.cost.sponsoredFg }}
                >
                  <T.LabelSm color={colors.cost.sponsoredFg}>Keep request</T.LabelSm>
                </Pressable>
              </Row>
            </Stack>
          </FadeUp>
        ) : (
          <FadeUp duration={400} delay={180} style={{ width: '100%', marginTop: spacing.xxl }}>
            <Stack gap="sm">
              <Button variant="secondary" label="Back to home" onPress={() => navigation.popToTop()} />
              <Pressable onPress={() => setCanceling(true)} style={{ alignSelf: 'center', padding: spacing.sm }}>
                <T.Semibold color={colors.textDim}>Withdraw request</T.Semibold>
              </Pressable>
            </Stack>
          </FadeUp>
        )}
      </ScreenPad>
    </Screen>
  );
}
