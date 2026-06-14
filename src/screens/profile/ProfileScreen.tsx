import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { SectionBlock } from '@/components/layout/SectionBlock';
import { Spacer } from '@/components/layout/Spacer';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon, IconName } from '@/components/atoms/Icon';
import { EmptyState } from '@/components/atoms/EmptyState';
import { VerifiedBadge } from '@/components/atoms/VerifiedBadge';
import { FamiliarFaceItem } from '@/components/atoms/FamiliarFaceItem';
import * as T from '@/components/atoms/T';
import { TabBar } from '@/components/molecules/TabBar';
import { TrustGrid } from '@/components/molecules/TrustGrid';
import { InterestPills } from '@/components/molecules/InterestPills';
import { SocialLinks } from '@/components/molecules/SocialLinks';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes, HIT_SLOP, CATEGORIES } from '@/theme/tokens';
import { CURRENT_USER_ID, getUserById, plans, recaps } from '@/mocks';
import { RecapCard } from '@/components/molecules/RecapCard';
import { PlanHistoryRow } from '@/components/molecules/PlanHistoryRow';
import { planDetailRoute } from '@/utils/plan';
import { useToast } from '@/hooks/useToast';
import { getMyProfile } from '@/api/users';
import { getEndorsementSummary, getFamiliarFaces, type EndorsementCount, type FamiliarFace } from '@/api/trust';
import type { User } from '@/types';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'Profile'>;
type ProfileTab = 'hosted' | 'joined' | 'recaps';

export function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<ProfileTab>('hosted');

  // Real identity + Trust data (Wave 4): profile/score, endorsement summary,
  // familiar faces. Plan-history tabs + follow counts remain mock pending the
  // Social wave (no plan-history / follows read RPCs yet).
  const [me, setMe] = useState<User | null>(null);
  const [endorsements, setEndorsements] = useState<EndorsementCount[]>([]);
  const [familiarFaces, setFamiliarFaces] = useState<FamiliarFace[]>([]);

  const load = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setMe(profile);
      if (profile) {
        const [es, ff] = await Promise.all([
          getEndorsementSummary(profile.id),
          getFamiliarFaces(),
        ]);
        setEndorsements(es);
        setFamiliarFaces(ff);
      }
    } catch { /* keep prior data on transient failure */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Plan-history tabs are still mock (Social/history wave — no history RPC).
  const mockMe = getUserById(CURRENT_USER_ID)!;
  const hosted = plans.filter((p) => p.hostId === mockMe.id);
  const joined  = plans.filter((p) => p.joinerIds.includes(mockMe.id));
  const myRecaps = recaps.filter((r) => r.authorId === mockMe.id);

  if (!me) {
    return (
      <Screen scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  const header = (
    <ScreenPad>
      <Row style={{ paddingTop: spacing.lg - 2, paddingBottom: spacing.sm + 2 }}>
        <T.PageTitle>Profile</T.PageTitle>
        <Spacer flex />
        <Pressable onPress={() => navigation.navigate('ProfileEdit')} hitSlop={HIT_SLOP.sm}>
          <Icon name="pencil" size={iconSizes.md} color={colors.textSub} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={HIT_SLOP.sm} style={{ marginLeft: spacing.md }}>
          <Icon name="settings" size={iconSizes.md} color={colors.textSub} />
        </Pressable>
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header} scroll={false}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <ScreenPad>
          <Row gap="lg" align="flex-start" style={{ paddingBottom: spacing.lg }}>
            <View style={{ position: 'relative' }}>
              <Avatar uri={me.avatarUri} name={me.name} size={avatarSizes.xxl} shape="rounded" borderRadius={24} />
              {me.isVerified ? <VerifiedBadge /> : null}
            </View>
            <Stack style={{ flex: 1, paddingTop: spacing.xs }}>
              <T.Heading>{me.name}</T.Heading>
              <T.Meta style={{ marginTop: spacing.xs / 2 }}>{me.handle} · {me.neighbourhood}</T.Meta>
              <Row gap="md" style={{ marginTop: spacing.sm }}>
                <Pressable onPress={() => navigation.navigate('FollowList', { userId: me.id, tab: 'followers' })}>
                  <T.StatNum>142 <T.Meta>Followers</T.Meta></T.StatNum>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('FollowList', { userId: me.id, tab: 'following' })}>
                  <T.StatNum>38 <T.Meta>Following</T.Meta></T.StatNum>
                </Pressable>
              </Row>
            </Stack>
          </Row>
        </ScreenPad>

        <TrustGrid hosted={me.plansHosted} joined={me.plansAttended} attendance={me.attendanceScore} met={me.peopleMet} />

        <InterestPills interests={me.interests} />

        {me.bio ? (
          <SectionBlock>
            <T.BodyLg color={colors.textSub}>{me.bio}</T.BodyLg>
          </SectionBlock>
        ) : null}

        {me.socialLinks ? <SocialLinks links={me.socialLinks} /> : null}

        {familiarFaces.length > 0 ? (
          <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs, borderTopWidth: borderWidths.thin, borderTopColor: colors.border }}>
            <Row justify="space-between" style={{ paddingHorizontal: spacing.screenPx, marginBottom: spacing.md }}>
              <T.CapsSm>Familiar Faces <T.MetaXs>{familiarFaces.length}</T.MetaXs></T.CapsSm>
              <Pressable onPress={() => navigation.navigate('FamiliarFaces', { userId: me.id })}>
                <T.LabelSm color={colors.coral}>See all →</T.LabelSm>
              </Pressable>
            </Row>
            <GestureScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.screenPx, gap: spacing.lg - 2, paddingBottom: spacing.xs }}
            >
              {familiarFaces.map((face) => (
                <FamiliarFaceItem
                  key={face.user.id}
                  uri={face.user.avatarUri}
                  name={face.user.name}
                  onPress={() => navigation.navigate('ProfileOther', { userId: face.user.id })}
                />
              ))}
            </GestureScrollView>
          </View>
        ) : null}

        {endorsements.length > 0 ? (
          <SectionBlock>
            <T.CapsSm style={{ marginBottom: spacing.sm + 2 }}>Endorsements</T.CapsSm>
            <Row wrap gap="sm">
              {endorsements.map((e) => (
                <View
                  key={e.label}
                  style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: radii.full, borderWidth: borderWidths.medium, backgroundColor: colors.cost.freeBg, borderColor: colors.cost.freeBorder }}
                >
                  <T.LabelSm color={colors.cost.freeFg}>{e.label} · {e.count}</T.LabelSm>
                </View>
              ))}
            </Row>
          </SectionBlock>
        ) : null}

        <TabBar
          tabs={[
            { id: 'hosted',  label: `Hosted · ${hosted.length}` },
            { id: 'joined',  label: `Joined · ${joined.length}` },
            { id: 'recaps',  label: `Recaps · ${myRecaps.length}` },
          ]}
          active={tab}
          onSelect={(id) => setTab(id as ProfileTab)}
        />

        {tab === 'hosted' ? (
          hosted.length === 0
            ? <EmptyState emoji="📋" title="Nothing yet" sub="Plans you host show up here." />
            : hosted.map((p) => <PlanHistoryRow key={p.id} plan={p} onPress={() => navigation.navigate(planDetailRoute(p, true), { planId: p.id })} />)
        ) : tab === 'joined' ? (
          joined.length === 0
            ? <EmptyState emoji="📋" title="Nothing yet" sub="Plans you join show up here." />
            : joined.map((p) => <PlanHistoryRow key={p.id} plan={p} onPress={() => navigation.navigate(planDetailRoute(p), { planId: p.id })} />)
        ) : (
          myRecaps.length === 0
            ? <EmptyState emoji="📸" title="No recaps yet" sub="Post your first recap after a plan ends." cta="Post a recap" onCtaPress={() => navigation.getParent()?.navigate('RecapsTab' as never)} />
            : myRecaps.map((r) => <RecapCard key={r.id} recap={r} onPress={() => navigation.navigate('RecapDetail', { recapId: r.id })} />)
        )}
        <Spacer size="xxxl" />
      </ScrollView>
    </Screen>
  );
}

