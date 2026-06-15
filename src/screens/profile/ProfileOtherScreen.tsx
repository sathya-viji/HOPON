import React, { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { VerifiedBadge } from '@/components/atoms/VerifiedBadge';
import * as T from '@/components/atoms/T';
import { TrustGrid } from '@/components/molecules/TrustGrid';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { SocialLinks } from '@/components/molecules/SocialLinks';
import { RecapCard } from '@/components/molecules/RecapCard';
import { PlanHistoryRow } from '@/components/molecules/PlanHistoryRow';
import { TabBar } from '@/components/molecules/TabBar';
import { EmptyState } from '@/components/atoms/EmptyState';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes, HIT_SLOP } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { planDetailRoute } from '@/utils/plan';
import { useFocusResource } from '@/api/hooks/useFocusResource';
import { getPublicProfile } from '@/api/users';
import { getUserRecaps } from '@/api/recaps';
import { getUserHostedPlans } from '@/api/plans';
import { getFollowState, followUser, unfollow, type FollowState } from '@/api/follows';
import { getFamiliarFaceWith } from '@/api/trust';
import { blockUser, unblockUser, isBlocked, submitReport, type ReportReasonValue } from '@/api/safety';
import { supabase } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { timeAgo } from '@/utils/time';
import type { User, Recap, Plan } from '@/types';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ProfileOther'>;

interface Loaded {
  profile: User | null;
  blocked: boolean;
  followState: FollowState;
  crossed: { plansTogether: number; lastMetAt: string } | null;
  recaps: Recap[];
  hosted: Plan[];
  myUid: string | null;
}

const REPORT_REASONS: { label: string; value: ReportReasonValue }[] = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Fake profile', value: 'fake_profile' },
  { label: 'Safety concern', value: 'safety_concern' },
  { label: 'Other', value: 'other' },
];

export function ProfileOtherScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const userId = route.params.userId;
  const [tab, setTab] = useState<'hosted' | 'joined' | 'recaps'>('hosted');
  const [followBusy, setFollowBusy] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);

  const load = useCallback(async (): Promise<Loaded> => {
    const { data: { session } } = await supabase.auth.getSession();
    const myUid = session?.user?.id ?? null;
    const blocked = await isBlocked(userId);
    if (blocked) {
      return { profile: null, blocked: true, followState: 'none', crossed: null, recaps: [], hosted: [], myUid };
    }
    const profile = await getPublicProfile(userId);
    const [followState, crossed, recaps, hosted] = await Promise.all([
      getFollowState(userId).catch(() => 'none' as FollowState),
      getFamiliarFaceWith(userId).catch(() => null),
      profile ? getUserRecaps(userId, { id: profile.id, name: profile.name, handle: profile.handle, avatarUri: profile.avatarUri }).catch(() => []) : Promise.resolve([]),
      profile ? getUserHostedPlans(userId).catch(() => []) : Promise.resolve([]),
    ]);
    return { profile, blocked: false, followState, crossed, recaps, hosted, myUid };
  }, [userId]);

  const { data, loading, error, refetch, set } = useFocusResource(load, [userId]);

  const toggleFollow = useCallback(async () => {
    if (!data?.profile || followBusy) return;
    setFollowBusy(true);
    const cur = data.followState;
    try {
      if (cur === 'none') {
        const s = await followUser(userId);
        set({ ...data, followState: s });
        toast.show(s === 'pending' ? 'Follow request sent' : 'Following');
      } else {
        await unfollow(userId);
        set({ ...data, followState: 'none' });
      }
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t update follow.'));
    } finally {
      setFollowBusy(false);
    }
  }, [data, followBusy, userId, set, toast]);

  const doBlock = useCallback(async () => {
    setBlockConfirm(false);
    try { await blockUser(userId); toast.show('Blocked'); refetch(); }
    catch (e) { toast.show(errorMessage(e, 'Couldn’t block.')); }
  }, [userId, refetch, toast]);

  const doUnblock = useCallback(async () => {
    try { await unblockUser(userId); toast.show('Unblocked'); refetch(); }
    catch (e) { toast.show(errorMessage(e, 'Couldn’t unblock.')); }
  }, [userId, refetch, toast]);

  const report = useCallback(() => {
    Alert.alert('Report this person', 'Why are you reporting them?', [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: async () => {
          try { await submitReport('user', userId, r.value); toast.show('Thanks — our team will review this.'); }
          catch (e) { toast.show(errorMessage(e, 'Couldn’t submit report.')); }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [userId, toast]);

  const header = (
    <ScreenHeader
      onBack={() => navigation.goBack()}
      trailing={
        <>
          <Pressable onPress={() => (data?.blocked ? doUnblock() : setBlockConfirm(true))} hitSlop={HIT_SLOP.sm}>
            <Icon name="ban" size={iconSizes.md} color={data?.blocked ? colors.coral : colors.textDim} />
          </Pressable>
          <Pressable onPress={report} hitSlop={HIT_SLOP.sm}>
            <Icon name="flag" size={iconSizes.md} color={colors.textDim} />
          </Pressable>
        </>
      }
    />
  );

  if (loading) {
    return (
      <Screen header={header} scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  // Blocked: profile is hidden by RLS; offer unblock.
  if (data?.blocked) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="🚫" title="You’ve blocked this person" sub="You won’t see their plans, recaps, or profile. Unblock to see them again." cta="Unblock" onCtaPress={doUnblock} />
      </Screen>
    );
  }

  // Gated: profile not visible (private/followers-only & not following, or not found).
  if (error || !data?.profile) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          emoji="🔒"
          title="This profile is private"
          sub="Send a follow request — once they accept, you’ll see their plans and recaps."
          cta="Request to follow"
          onCtaPress={async () => {
            try { const s = await followUser(userId); toast.show(s === 'pending' ? 'Follow request sent' : 'Following'); }
            catch (e) { toast.show(errorMessage(e, 'Couldn’t send request.')); }
          }}
        />
      </Screen>
    );
  }

  const other = data.profile;
  const { followState, crossed, recaps, hosted } = data;
  const isFollowing = followState === 'accepted';

  return (
    <View style={{ flex: 1, position: 'relative', backgroundColor: colors.bg }}>
      <Screen header={header} scroll={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenPad>
            <Row gap="lg" align="flex-start" style={{ paddingBottom: spacing.lg, paddingTop: spacing.sm }}>
              <View style={{ position: 'relative' }}>
                <Avatar uri={other.avatarUri} name={other.name} size={avatarSizes.xxl} shape="rounded" borderRadius={24} />
                {other.isVerified ? <VerifiedBadge /> : null}
              </View>
              <Stack style={{ flex: 1, paddingTop: spacing.xs }}>
                <T.Heading>{other.name}</T.Heading>
                <T.Meta style={{ marginTop: spacing.xs / 2 }}>{other.handle} · {other.neighbourhood}</T.Meta>
                {other.bio ? <T.Meta color={colors.textSub} style={{ marginTop: 5 }} numberOfLines={2}>{other.bio}</T.Meta> : null}
                <Row gap="sm" style={{ marginTop: spacing.sm + 2 }}>
                  <Pressable
                    onPress={toggleFollow}
                    disabled={followBusy}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg, borderWidth: borderWidths.medium, borderRadius: radii.sm, alignSelf: 'flex-start', opacity: followBusy ? 0.6 : 1, backgroundColor: followState !== 'none' ? colors.cost.freeBg : colors.coral, borderColor: followState !== 'none' ? colors.cost.freeFg : colors.coral }}
                  >
                    {isFollowing ? <Icon name="check" size={iconSizes.xxs + 1} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                    <T.LabelMd color={followState !== 'none' ? colors.cost.freeFg : colors.white}>
                      {isFollowing ? 'Following' : followState === 'pending' ? 'Requested' : '+ Follow'}
                    </T.LabelMd>
                  </Pressable>
                </Row>
              </Stack>
            </Row>
          </ScreenPad>

          <TrustGrid hosted={other.plansHosted} joined={other.plansAttended} attendance={other.attendanceScore} met={other.peopleMet} />

          {crossed ? (
            <ScreenPad>
              <Row gap="sm" style={{ padding: spacing.md, borderRadius: radii.sm, marginVertical: spacing.lg, backgroundColor: colors.cost.freeBg }}>
                <Icon name="users" size={iconSizes.sm} color={colors.green} />
                <Stack gap={1}>
                  <T.LabelMd color={colors.cost.freeFg}>{crossed.plansTogether} {crossed.plansTogether === 1 ? 'plan' : 'plans'} together</T.LabelMd>
                  <T.Meta color={colors.cost.freeFg}>Last met {timeAgo(crossed.lastMetAt)}</T.Meta>
                </Stack>
              </Row>
            </ScreenPad>
          ) : null}

          {other.socialLinks ? <SocialLinks links={other.socialLinks} /> : null}

          <TabBar
            tabs={[
              { id: 'hosted', label: `Hosted · ${hosted.length}` },
              { id: 'joined', label: 'Joined' },
              { id: 'recaps', label: `Recaps · ${recaps.length}` },
            ]}
            active={tab}
            onSelect={(id) => setTab(id as typeof tab)}
          />

          {tab === 'hosted' ? (
            hosted.length === 0
              ? <EmptyState emoji="📋" title="Nothing yet" sub={`Plans ${other.name.split(' ')[0]} hosts show up here.`} />
              : hosted.map((p) => <PlanHistoryRow key={p.id} plan={p} onPress={() => navigation.navigate(planDetailRoute(p), { planId: p.id })} />)
          ) : tab === 'joined' ? (
            <EmptyState emoji="🔒" title="Joined plans are private" sub="Only plans someone hosts are shown on their profile." />
          ) : (
            recaps.length === 0
              ? <EmptyState emoji="📸" title="No recaps yet" sub={`${other.name.split(' ')[0]} hasn't posted any recaps.`} />
              : recaps.map((r) => <RecapCard key={r.id} recap={r} onPress={() => navigation.navigate('RecapDetail', { recapId: r.id })} />)
          )}
          <Spacer size="xxxl" />
        </ScrollView>
      </Screen>

      {blockConfirm ? (
        <Pressable style={{ ...StyleSheet_absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, justifyContent: 'flex-end' }} onPress={() => setBlockConfirm(false)}>
          <Pressable onPress={() => {}} style={{ borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.xxl, paddingHorizontal: spacing.screenPx, paddingBottom: spacing.xxxl, backgroundColor: colors.bg }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl, backgroundColor: colors.borderMid }} />
            <Stack gap="md" align="center" style={{ marginBottom: spacing.xl }}>
              <Avatar uri={other.avatarUri} name={other.name} size={56} shape="circle" />
              <T.Subheading style={{ marginTop: spacing.md }}>Block {other.name}?</T.Subheading>
              <T.BodyMd color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260 }}>
                They won't be able to see your plans or profile. You won't see theirs either.
              </T.BodyMd>
            </Stack>
            <Stack gap="sm">
              <Pressable onPress={doBlock} style={{ borderRadius: radii.xxl, paddingVertical: spacing.lg - 1, alignItems: 'center', backgroundColor: colors.cost.sponsoredFg }}>
                <T.LabelLg color={colors.white}>Block {other.name}</T.LabelLg>
              </Pressable>
              <Button variant="secondary" label="Cancel" onPress={() => setBlockConfirm(false)} />
            </Stack>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const StyleSheet_absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
