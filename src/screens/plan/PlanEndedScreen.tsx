import React from 'react';
import { Text } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { ActivityIndicator } from 'react-native';
import { AvatarStack } from '@/components/molecules/AvatarStack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, borderWidths } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import type { HomeStackParamList } from '@/navigation/types';

// Cross-stack navigation: `getParent()` reaches the tab navigator whose type
// React Navigation doesn't expose via StackScreenProps. This alias documents intent.
type TabNav = { navigate: (tab: string, params?: Record<string, unknown>) => void };

type Props = StackScreenProps<HomeStackParamList, 'PlanEnded'>;

export function PlanEndedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const planId = route.params?.planId;
  const { detail, loading } = usePlanDetail(planId);

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>How did it go?</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  if (loading && !detail) {
    return (
      <Screen header={header}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen header={header}>
        <ScreenPad style={{ paddingTop: spacing.xxxl, alignItems: 'center' }}>
          <T.BodyMd color={colors.textSub}>This plan isn’t available.</T.BodyMd>
        </ScreenPad>
      </Screen>
    );
  }

  const { plan, joiners, viewerIsHost } = detail;
  const count = joiners.length;

  return (
    <Screen header={header}>
      <ScreenPad style={{ paddingTop: spacing.lg, paddingBottom: spacing.md, alignItems: 'center', borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>🎉</Text>
        <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.xs }}>{plan.activity} · Done!</T.Subheading>
        <T.Meta>{plan.location}</T.Meta>
      </ScreenPad>

      {count > 0 ? (
        <Pressable
          onPress={() => navigation.navigate('Endorse', { planId: plan.id })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginHorizontal: spacing.screenPx, marginVertical: spacing.sm, borderWidth: borderWidths.medium, borderRadius: radii.lg, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <AvatarStack uris={joiners.map((a) => a.avatarUri ?? '').slice(0, 3)} max={3} size={36} borderColor={colors.bg} />
          <Stack style={{ flex: 1 }}>
            <T.LabelMd>{viewerIsHost ? 'Mark attendance & endorse' : 'Endorse your crew'}</T.LabelMd>
            <T.Meta>{count} attendee{count === 1 ? '' : 's'} · Tap to review</T.Meta>
          </Stack>
          <Icon name="chevron-right" size={iconSizes.sm} color={colors.textDim} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => (navigation.getParent() as unknown as TabNav | undefined)?.navigate('RecapsTab', { screen: 'RecapPost', params: { planId: plan.id } })}
        style={{ padding: spacing.md, marginHorizontal: spacing.screenPx, marginVertical: spacing.md, borderRadius: radii.lg, backgroundColor: colors.cost.copayBg }}
      >
        <Row gap="sm" style={{ marginBottom: spacing.sm }}>
          <Icon name="image-plus" size={iconSizes.lg} color={colors.cost.copayFg} />
          <T.LabelMd color={colors.cost.copayFg}>Share the moment</T.LabelMd>
        </Row>
        <T.BodyMd color={colors.cost.copayFg}>Post a photo recap so others in your neighbourhood can see what it was like.</T.BodyMd>
      </Pressable>

      <Stack gap="sm" style={{ padding: spacing.md, marginHorizontal: spacing.screenPx, marginBottom: spacing.md, borderRadius: radii.lg, backgroundColor: colors.cost.freeBg }}>
        <Row gap="sm">
          <Icon name="users" size={iconSizes.md} color={colors.cost.freeFg} />
          <T.LabelMd color={colors.cost.freeFg}>+{count} to Familiar Faces</T.LabelMd>
        </Row>
        <T.MetaXs color={colors.cost.freeFg}>These people are now in your social graph. You'll see if you cross paths again.</T.MetaXs>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('ProfileTab' as never)}
          style={{ alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: colors.cost.freeFg }}
        >
          <T.LabelXs color={colors.white}>See Familiar Faces →</T.LabelXs>
        </Pressable>
      </Stack>

      <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl }}>
        <Button variant="primary" label="Back to home" onPress={() => navigation.popToTop()} />
      </ScreenPad>
    </Screen>
  );
}
