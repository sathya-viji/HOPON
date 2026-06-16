import React, { useCallback } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FadeUp } from '@/components/atoms/FadeUp';
import { Tap } from '@/components/atoms/Tap';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/atoms/EmptyState';
import { NotifRow } from '@/components/molecules/NotifRow';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths } from '@/theme/tokens';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/hooks/useToast';
import { approveRequest, declineRequest } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import type { HomeStackParamList } from '@/navigation/types';
import { Notification, NotifType } from '@/types';

// Cross-stack navigation: `getParent()` reaches the tab navigator whose type
// React Navigation doesn't expose via StackScreenProps. This alias documents intent.
type TabNav = { navigate: (tab: string, params?: Record<string, unknown>) => void };

// Plan-param navigation target per type (null = no target / handled specially:
// recap types route via recapId, social types via the actor's userId below).
const ROUTE_FOR_TYPE: Record<NotifType, keyof HomeStackParamList | null> = {
  plan_posted: 'PlanHost',
  new_joiner: 'PlanHost',
  join_request: 'PlanRequests',
  joiner_left: 'PlanHost',
  plan_full: 'PlanHost',
  plan_starting_soon_host: 'PlanHost',
  plan_started_host: 'PlanHost',
  plan_ended_host: 'Endorse',
  endorse_reminder: 'Endorse',
  recap_reminder: 'PlanHost',
  plan_cancelled_confirm: 'Plan',
  host_marked_absent: 'PlanHost',
  new_recap_on_your_plan: 'Plan',
  request_approved: 'Plan',
  request_declined: 'PlanDeclined',
  plan_updated: 'Plan',
  plan_cancelled: 'Plan',
  plan_starting_soon_joiner: 'Plan',
  plan_starting_15: 'Plan',
  plan_ended_joiner: 'Endorse',
  marked_noshow: 'Plan',
  mention: 'Chat',
  endorsement_received: null,
  attendance_score_improved: null,
  attendance_score_dropped: null,
  new_familiar_face: null,
  recap_liked: null,
  recap_commented: null,
  recap_comment_replied: null,
  new_recap_from_following: null,
  story_expiring_soon: null,
  new_follower: null,
  follow_request: null,
  follow_accepted: null,
  following_posted_plan: 'Plan',
  welcome: null,
  profile_incomplete: null,
  first_plan_nudge: null,
  contact_joined: null,
  plan_expired_host: 'PlanHost',
  plan_expired_joiner: 'Plan',
};

const RECAP_TYPES = new Set<NotifType>([
  'new_recap_on_your_plan', 'recap_liked', 'recap_commented',
  'recap_comment_replied', 'new_recap_from_following',
]);
const PROFILE_TYPES = new Set<NotifType>([
  'new_follower', 'follow_request', 'follow_accepted', 'contact_joined',
]);

type Props = StackScreenProps<HomeStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { notifs, unreadCount, loading, markNotifRead, markAllNotifsRead, refreshNotifs } = useSession();

  // Freshen on focus (realtime keeps it live while open; this catches changes
  // made elsewhere — e.g. approving from PlanRequests — when returning here).
  useFocusEffect(useCallback(() => { refreshNotifs(); }, [refreshNotifs]));

  const handleTap = (n: Notification) => {
    markNotifRead(n.id);
    if (RECAP_TYPES.has(n.type) && n.recapId) {
      navigation.navigate('RecapDetail', { recapId: n.recapId });
      return;
    }
    if (PROFILE_TYPES.has(n.type) && n.userId) {
      navigation.navigate('ProfileOther', { userId: n.userId });
      return;
    }
    const route = ROUTE_FOR_TYPE[n.type];
    if (route && n.planId) (navigation as unknown as { navigate: (r: string, p: Record<string, string>) => void }).navigate(route, { planId: n.planId });
  };

  const decide = async (n: Notification, approved: boolean) => {
    if (!n.planId || !n.userId) { markNotifRead(n.id); return; }
    try {
      if (approved) await approveRequest(n.planId, n.userId);
      else await declineRequest(n.planId, n.userId);
      markNotifRead(n.id);
      toast.show(approved ? 'Request approved' : 'Request declined');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t update the request.'));
    }
  };

  const header = (
    <ScreenPad style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row gap="md" style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.PageTitle>Notifications</T.PageTitle>
        {unreadCount > 0 ? (
          <Row style={{ paddingVertical: 2, paddingHorizontal: spacing.sm - 1, borderRadius: radii.full, backgroundColor: colors.coral }}>
            <T.LabelXs color={colors.white}>{unreadCount} new</T.LabelXs>
          </Row>
        ) : null}
        <Spacer flex />
        {unreadCount > 0 ? (
          <Tap onPress={markAllNotifsRead} hitSlop={spacing.sm}>
            <T.Semibold color={colors.coral}>Mark all read</T.Semibold>
          </Tap>
        ) : null}
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        data={notifs}
        keyExtractor={(n) => n.id}
        renderItem={({ item, index }) => (
          <FadeUp delay={index * 30} duration={300}>
            <NotifRow
              notif={item}
              onPress={handleTap}
              onApprove={() => decide(item, true)}
              onDecline={() => decide(item, false)}
              onPostRecap={(planId) =>
                (navigation.getParent() as unknown as TabNav | undefined)?.navigate('RecapsTab', { screen: 'RecapPost', params: { planId } })
              }
            />
          </FadeUp>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : (
            <EmptyState emoji="🔔" title="All caught up" sub="No new activity yet." />
          )
        }
      />
    </Screen>
  );
}
