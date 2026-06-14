import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { Countdown } from '@/components/atoms/Countdown';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { AvatarStack } from '@/components/molecules/AvatarStack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { usePlanMembers } from '@/api/hooks/usePlanMembers';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanHost'>;

export function PlanHostScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const { members } = usePlanMembers(planId);

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
  const attendees = members.filter((m) => m.status === 'joined' || m.status === 'approved');
  const pending = members.filter((m) => m.status === 'requested');
  const pendingCount = pending.length;

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Your plan</T.LabelLg>
        <Spacer flex />
        <Pressable onPress={() => navigation.navigate('PlanEdit', { planId: plan.id })} hitSlop={spacing.sm}>
          <Icon name="pencil" size={iconSizes.md} color={colors.textSub} />
        </Pressable>
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        <Stack gap="sm" style={{ padding: spacing.md, borderWidth: borderWidths.thin, borderRadius: radii.lg, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Row gap="md">
            <Stack style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
              <Icon name={cat.icon as never} size={22} color={cat.iconColor} strokeWidth={2} />
            </Stack>
            <Stack style={{ flex: 1 }}>
              <T.LabelLg numberOfLines={1}>{plan.activity}</T.LabelLg>
              <T.MetaXs numberOfLines={1}>{plan.location}</T.MetaXs>
            </Stack>
          </Row>
          <Row gap="sm" wrap>
            <Countdown startsAt={plan.startsAt} />
            <Row gap={4} style={{ paddingVertical: 2, paddingHorizontal: spacing.sm - 1, borderRadius: radii.xs, backgroundColor: colors.surfaceMid }}>
              <T.LabelXs color={colors.textSub}>{plan.capacity - plan.spotsRemaining}/{plan.capacity} joined</T.LabelXs>
            </Row>
          </Row>
        </Stack>
      </ScreenPad>

      <ScreenPad style={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
        <Row gap="sm">
          <Pressable
            onPress={() => navigation.navigate('Chat', { planId: plan.id })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 13, borderRadius: radii.md, backgroundColor: colors.ctaBg }}
          >
            <Icon name="message-circle" size={iconSizes.xs} color={colors.ctaFg} />
            <T.LabelSm color={colors.ctaFg}>Chat</T.LabelSm>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('PlanEdit', { planId: plan.id })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 13, borderRadius: radii.md, borderWidth: borderWidths.medium, borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Icon name="pencil" size={iconSizes.xs} color={colors.textSub} />
            <T.LabelSm>Edit</T.LabelSm>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('PlanCancelConfirm', { planId: plan.id })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 13, borderRadius: radii.md, backgroundColor: colors.cost.sponsoredBg }}
          >
            <Icon name="x" size={iconSizes.xs} color={colors.cost.sponsoredFg} />
            <T.LabelSm color={colors.cost.sponsoredFg}>Cancel</T.LabelSm>
          </Pressable>
        </Row>
      </ScreenPad>

      {pendingCount > 0 ? (
        <ScreenPad style={{ paddingBottom: spacing.lg }}>
          <Pressable
            onPress={() => navigation.navigate('PlanRequests', { planId: plan.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.cost.copayBg }}
          >
            <AvatarStack uris={pending.slice(0, 2).map((u) => u.avatarUri ?? '')} max={3} size={32} borderColor={colors.cost.copayBg} />
            <Stack style={{ flex: 1 }}>
              <T.LabelSm color={colors.cost.copayFg}>{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</T.LabelSm>
              <T.MetaXs color={colors.cost.copayFg}>Tap to approve or decline</T.MetaXs>
            </Stack>
            <Icon name="chevron-right" size={iconSizes.sm} color={colors.cost.copayFg} />
          </Pressable>
        </ScreenPad>
      ) : null}

      <SectionHeader label="ATTENDEES" count={attendees.length} />
      {attendees.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => navigation.navigate('ProfileOther', { userId: a.id })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
        >
          <Avatar uri={a.avatarUri} name={a.name} size={40} shape="circle" />
          <Stack style={{ flex: 1 }}>
            <T.Semibold numberOfLines={1}>{a.name}</T.Semibold>
            <T.MetaXs color={colors.green}>{a.attendanceScore !== null ? `${a.attendanceScore}% attendance` : 'New'}</T.MetaXs>
          </Stack>
          <Icon name="chevron-right" size={iconSizes.sm} color={colors.textDim} />
        </Pressable>
      ))}
      <Spacer size="xxxl" />
    </Screen>
  );
}
