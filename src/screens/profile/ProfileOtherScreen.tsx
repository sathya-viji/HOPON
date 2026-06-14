import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScrollContent } from '@/components/layout/ScrollContent';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { VerifiedBadge } from '@/components/atoms/VerifiedBadge';
import { FamiliarFaceItem } from '@/components/atoms/FamiliarFaceItem';
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
import { users, getUserById, CURRENT_USER_ID, plans, recaps } from '@/mocks';
import { useToast } from '@/hooks/useToast';
import { planDetailRoute } from '@/utils/plan';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ProfileOther'>;

const CROSSED: Record<string, { plansTogetherCount: number; lastMet: string }> = {
  u1: { plansTogetherCount: 3, lastMet: '2d ago' },
  u3: { plansTogetherCount: 1, lastMet: '1w ago' },
};

export function ProfileOtherScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const other = getUserById(route.params.userId) ?? users[1];
  const me = getUserById(CURRENT_USER_ID)!;
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [tab, setTab] = useState<'hosted' | 'joined' | 'recaps'>('hosted');

  const crossed = CROSSED[other.id];
  const hosted = plans.filter((p) => p.hostId === other.id);
  const joined = plans.filter((p) => p.joinerIds.includes(other.id));
  const theirRecaps = recaps.filter((r) => r.authorId === other.id);
  const commonFaces = me.familiarFaceIds
    .filter((id) => id !== other.id)
    .slice(0, 3)
    .map((id) => getUserById(id))
    .filter(Boolean) as typeof users;

  const header = (
    <ScreenHeader
      onBack={() => navigation.goBack()}
      trailing={
        <>
          <Pressable onPress={() => setBlockConfirm(true)} hitSlop={HIT_SLOP.sm}>
            <Icon name="ban" size={iconSizes.md} color={colors.textDim} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ReportUser', { userId: other.id })} hitSlop={HIT_SLOP.sm}>
            <Icon name="flag" size={iconSizes.md} color={colors.textDim} />
          </Pressable>
        </>
      }
    />
  );

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
                <Row
                  gap="sm"
                  style={{ marginTop: spacing.sm + 2 }}
                >
                  {blocked ? (
                    <Pressable
                      onPress={() => { setBlocked(false); toast.show('Unblocked'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg - 2, borderWidth: borderWidths.medium, borderRadius: radii.sm, alignSelf: 'flex-start', backgroundColor: colors.cost.sponsoredBg, borderColor: colors.cost.sponsoredFg }}
                    >
                      <Icon name="ban" size={iconSizes.xs} color={colors.cost.sponsoredFg} />
                      <T.LabelMd color={colors.cost.sponsoredFg}>Blocked · Unblock</T.LabelMd>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setFollowing((v) => !v)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg, borderWidth: borderWidths.medium, borderRadius: radii.sm, alignSelf: 'flex-start', backgroundColor: following ? colors.cost.freeBg : colors.coral, borderColor: following ? colors.cost.freeFg : colors.coral }}
                    >
                      {following ? <Icon name="check" size={iconSizes.xxs + 1} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                      <T.LabelMd color={following ? colors.cost.freeFg : colors.white}>
                        {following ? 'Following' : '+ Follow'}
                      </T.LabelMd>
                    </Pressable>
                  )}
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
                  <T.LabelMd color={colors.cost.freeFg}>{crossed.plansTogetherCount} plans together</T.LabelMd>
                  <T.Meta color={colors.cost.freeFg}>Last met {crossed.lastMet}</T.Meta>
                </Stack>
              </Row>
            </ScreenPad>
          ) : null}

          {other.socialLinks ? <SocialLinks links={other.socialLinks} /> : null}

          {commonFaces.length > 0 ? (
            <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs, borderTopWidth: borderWidths.thin, borderTopColor: colors.border }}>
              <ScreenPad style={{ marginBottom: spacing.md }}>
                <T.CapsSm>Familiar Faces</T.CapsSm>
              </ScreenPad>
              <ScrollContent horizontal gap={spacing.lg - 2}>
                {commonFaces.map((face) => (
                  <FamiliarFaceItem key={face.id} uri={face.avatarUri} name={face.name} onPress={() => navigation.navigate('ProfileOther', { userId: face.id })} />
                ))}
              </ScrollContent>
            </View>
          ) : null}

          <TabBar
            tabs={[
              { id: 'hosted',  label: `Hosted · ${hosted.length}` },
              { id: 'joined',  label: `Joined · ${joined.length}` },
              { id: 'recaps',  label: `Recaps · ${theirRecaps.length}` },
            ]}
            active={tab}
            onSelect={(id) => setTab(id as typeof tab)}
          />

          {tab === 'hosted' ? (
            hosted.length === 0
              ? <EmptyState emoji="📋" title="Nothing yet" sub={`Plans ${other.name.split(' ')[0]} hosts show up here.`} />
              : hosted.map((p) => <PlanHistoryRow key={p.id} plan={p} onPress={() => navigation.navigate(planDetailRoute(p), { planId: p.id })} />)
          ) : tab === 'joined' ? (
            joined.length === 0
              ? <EmptyState emoji="📋" title="Nothing yet" sub={`Plans ${other.name.split(' ')[0]} joins show up here.`} />
              : joined.map((p) => <PlanHistoryRow key={p.id} plan={p} onPress={() => navigation.navigate(planDetailRoute(p), { planId: p.id })} />)
          ) : (
            theirRecaps.length === 0
              ? <EmptyState emoji="📸" title="No recaps yet" sub={`${other.name.split(' ')[0]} hasn't posted any recaps.`} />
              : theirRecaps.map((r) => <RecapCard key={r.id} recap={r} onPress={() => navigation.navigate('RecapDetail', { recapId: r.id })} />)
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
              <Pressable
                onPress={() => { setBlocked(true); setBlockConfirm(false); toast.show(`${other.name.split(' ')[0]} blocked`); }}
                style={{ borderRadius: radii.xxl, paddingVertical: spacing.lg - 1, alignItems: 'center', backgroundColor: colors.cost.sponsoredFg }}
              >
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
