import React from 'react';
import { FlatList } from 'react-native';
import { Pressable } from 'react-native';
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
import type { HomeStackParamList } from '@/navigation/types';
import { Notification, NotifType } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'Notifications'>;

const ROUTE_FOR_TYPE: Record<NotifType, keyof HomeStackParamList | null> = {
  new_joiner: 'PlanHost',
  join_request: 'PlanRequests',
  request_approved: 'Plan',
  request_declined: 'PlanDeclined',
  plan_ended: 'Endorse',
  new_recap: null,
  new_follower: null,
};

export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { notifs, markNotifRead, markAllNotifsRead } = useSession();
  const unread = notifs.filter((n) => !n.isRead).length;

  const handleTap = (n: Notification) => {
    markNotifRead(n.id);
    if (n.type === 'new_recap' && n.recapId) {
      navigation.navigate('RecapDetail', { recapId: n.recapId });
      return;
    }
    if (n.type === 'new_follower' && n.userId) {
      navigation.navigate('ProfileOther', { userId: n.userId });
      return;
    }
    const route = ROUTE_FOR_TYPE[n.type];
    if (route && n.planId) (navigation as any).navigate(route, { planId: n.planId });
  };

  const decide = (id: string, approved: boolean) => {
    markNotifRead(id);
    toast.show(approved ? 'Request approved' : 'Request declined');
  };

  const header = (
    <ScreenPad style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row gap="md" style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.PageTitle>Notifications</T.PageTitle>
        {unread > 0 ? (
          <Row style={{ paddingVertical: 2, paddingHorizontal: spacing.sm - 1, borderRadius: radii.full, backgroundColor: colors.coral }}>
            <T.LabelXs color={colors.white}>{unread} new</T.LabelXs>
          </Row>
        ) : null}
        <Spacer flex />
        {unread > 0 ? (
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
              onApprove={(id) => decide(id, true)}
              onDecline={(id) => decide(id, false)}
              onPostRecap={(planId) =>
                (navigation.getParent() as any)?.navigate('RecapsTab', { screen: 'RecapPost', params: { planId } })
              }
            />
          </FadeUp>
        )}
        ListEmptyComponent={<EmptyState emoji="🔔" title="All caught up" sub="No new activity yet." />}
      />
    </Screen>
  );
}
