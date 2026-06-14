import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Tap } from '@/components/atoms/Tap';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Countdown } from '@/components/atoms/Countdown';
import { CostTag } from '@/components/atoms/CostTag';
import { HostCard } from '@/components/molecules/HostCard';
import { AvatarStack } from '@/components/molecules/AvatarStack';
import { FamiliarFacesBanner } from '@/components/molecules/FamiliarFacesBanner';
import { GenderBadge } from '@/components/molecules/GenderBadge';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { formatDate } from '@/utils/time';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { joinPlan } from '@/api/plans';
import { errorMessage, errorCode } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'Plan'>;

export function PlanScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail, loading, error, refetch } = usePlanDetail(planId);
  const [joining, setJoining] = useState(false);

  const backHeader = (
    <ScreenPad>
      <Row gap="sm" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Spacer flex />
      </Row>
    </ScreenPad>
  );

  if (loading || !detail) {
    // A known plan_not_found/blocked means the plan is genuinely gone/hidden;
    // anything else (network drop, unknown server error) is transient, so the
    // copy should point at the connection rather than imply the plan vanished.
    const code = error ? errorCode(error) : null;
    const isMissing = code === 'plan_not_found' || code === 'blocked';
    return (
      <Screen header={backHeader} scroll={false}>
        {error ? (
          <EmptyState
            emoji={isMissing ? '🔍' : '📡'}
            title={isMissing ? 'This plan isn’t available' : 'Couldn’t load this plan'}
            sub={
              isMissing
                ? 'It may have been cancelled or is no longer visible to you.'
                : 'Check your connection and try again.'
            }
            cta="Try again"
            onCtaPress={refetch}
          />
        ) : (
          <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.coral} />
          </Stack>
        )}
      </Screen>
    );
  }

  const { plan, host, joiners, viewerIsHost, viewerMembership } = detail;
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
  const isMine = viewerIsHost;
  const isJoined = viewerMembership === 'joined' || viewerMembership === 'approved';
  const isRequested = viewerMembership === 'requested';
  const isFull = plan.status === 'full' || plan.spotsRemaining <= 0;

  const onJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const status = await joinPlan(plan.id);
      if (status === 'requested') navigation.navigate('PlanRequested', { planId: plan.id });
      else navigation.navigate('PlanJoined', { planId: plan.id });
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t join this plan.'));
      setJoining(false);
    }
  };

  const header = (
    <ScreenPad>
      <Row gap="sm" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Spacer flex />
        <Tap onPress={() => navigation.navigate('ReportPlan', { planId: plan.id })} hitSlop={spacing.sm} accessibilityLabel="Report plan">
          <Icon name="flag" size={iconSizes.md} color={colors.textDim} />
        </Tap>
        <Tap onPress={() => toast.show('Share')} hitSlop={spacing.sm} accessibilityLabel="Share plan">
          <Icon name="share-2" size={iconSizes.md} color={colors.textDim} />
        </Tap>
      </Row>
    </ScreenPad>
  );

  const footer = (
    <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      {isMine ? (
        <Button variant="primary" label="View as host" onPress={() => navigation.navigate('PlanHost', { planId: plan.id })} />
      ) : isJoined ? (
        <Row gap="sm">
          <View style={{ flex: 2 }}>
            <Button variant="primary" label="Open chat" onPress={() => navigation.navigate('Chat', { planId: plan.id })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" label="Leave" onPress={() => navigation.navigate('PlanLeaveConfirm', { planId: plan.id })} />
          </View>
        </Row>
      ) : isRequested ? (
        <Button variant="primary" label="Request pending" disabled />
      ) : isFull ? (
        <Button variant="primary" label="Plan is full" disabled />
      ) : plan.type === 'closed' ? (
        <Button variant="primary-coral" label={joining ? 'Requesting…' : 'Request to join'} onPress={onJoin} disabled={joining} />
      ) : (
        <Button variant="primary-coral" label={joining ? 'Joining…' : 'HOP ON'} onPress={onJoin} disabled={joining} />
      )}
    </ScreenPad>
  );

  return (
    <Screen header={header} footer={footer}>
      {/* Hero */}
      <ScreenPad style={{ paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <Stack style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm + 2, backgroundColor: cat.bg }}>
          <Icon name={cat.icon as never} size={26} color={cat.iconColor} strokeWidth={2} />
        </Stack>
        <T.Subheading style={{ marginBottom: spacing.xs }}>{plan.activity}</T.Subheading>
        <Row gap="sm" style={{ marginBottom: spacing.md }}>
          <Icon name="map-pin" size={iconSizes.xs} color={colors.textSub} />
          <T.BodyMd color={colors.textSub} numberOfLines={1} style={{ flex: 1 }}>{plan.location}</T.BodyMd>
        </Row>
        <Row gap="sm" wrap style={{ marginBottom: spacing.sm + 2 }}>
          <Countdown startsAt={plan.startsAt} />
          <Row gap={4} style={{ paddingVertical: 2, paddingHorizontal: spacing.sm - 1, borderRadius: radii.xs, backgroundColor: colors.surface }}>
            <Icon name="calendar" size={9} color={colors.textSub} />
            <T.LabelXs color={colors.textSub}>{formatDate(plan.startsAt)}</T.LabelXs>
          </Row>
          <CostTag type={plan.cost} note={plan.costNote} />
          {plan.type === 'closed' ? (
            <Row gap={4} style={{ paddingVertical: 2, paddingHorizontal: spacing.sm - 1, borderRadius: radii.xs, backgroundColor: colors.surface }}>
              <Icon name="lock" size={9} color={colors.textSub} />
              <T.LabelXs color={colors.textSub}>Closed plan</T.LabelXs>
            </Row>
          ) : null}
          <GenderBadge pref={plan.genderPref} />
        </Row>
        <Row gap="sm" style={{ marginBottom: spacing.xs }}>
          <AvatarStack uris={joiners.map((u) => u.avatarUri ?? '')} max={5} size={28} borderColor={colors.bg} />
          <T.Meta style={{ flex: 1 }}>
            {plan.capacity - plan.spotsRemaining} joined
            {plan.spotsRemaining > 0 ? (
              <T.Meta color={colors.coral}>
                {' · '}
                <T.Bold color={colors.coral}>{plan.spotsRemaining} spot{plan.spotsRemaining === 1 ? '' : 's'} left</T.Bold>
              </T.Meta>
            ) : (
              <T.Meta color={colors.textDim}>{' · '}<T.Bold color={colors.textDim}>Full</T.Bold></T.Meta>
            )}
          </T.Meta>
        </Row>
        <FamiliarFacesBanner faces={[]} />
      </ScreenPad>

      {host ? (
        <HostCard host={host} onPress={() => navigation.navigate('ProfileOther', { userId: host.id })} />
      ) : null}

      {plan.description ? (
        <ScreenPad style={{ paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
          <T.CapsSm style={{ marginBottom: spacing.sm }}>About this plan</T.CapsSm>
          <T.BodyLg>{plan.description}</T.BodyLg>
        </ScreenPad>
      ) : null}

      {plan.rules ? (
        <ScreenPad style={{ paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
          <T.CapsSm style={{ marginBottom: spacing.sm }}>Rules</T.CapsSm>
          <T.BodyMd color={colors.textSub}>{plan.rules}</T.BodyMd>
        </ScreenPad>
      ) : null}

      <ScreenPad style={{ paddingVertical: spacing.sm + 2 }}>
        <Row gap="sm" style={{ padding: spacing.md - 2, borderRadius: radii.sm, backgroundColor: colors.surface }}>
          <Icon name="shield-check" size={iconSizes.sm} color={colors.green} />
          <T.Meta color={colors.textSub} style={{ flex: 1 }}>
            Meet in public. Trust your instincts.{' '}
            <T.Meta color={colors.coral} onPress={() => navigation.navigate('Guidelines')}>
              Community guidelines →
            </T.Meta>
          </T.Meta>
        </Row>
      </ScreenPad>
      <Spacer size="lg" />
    </Screen>
  );
}
