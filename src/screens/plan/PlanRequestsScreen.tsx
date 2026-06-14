import React, { useState } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { TrustPill } from '@/components/atoms/TrustPill';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes, HIT_SLOP } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { usePlanMembers } from '@/api/hooks/usePlanMembers';
import { approveRequest, declineRequest } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanRequests'>;

export function PlanRequestsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);
  const { members, loading, refetch } = usePlanMembers(planId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requests = members.filter((m) => m.status === 'requested');

  const decide = async (userId: string, approved: boolean) => {
    if (!planId || busyId) return;
    setBusyId(userId);
    try {
      if (approved) await approveRequest(planId, userId);
      else await declineRequest(planId, userId);
      toast.show(approved ? 'Request approved' : 'Request declined');
      refetch();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t update the request.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen header={<ScreenHeader title="Join requests" onBack={() => navigation.goBack()} />} scroll={false}>
      <ScreenPad style={{ paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <T.BodyMd color={colors.textSub}>{detail?.plan.activity ?? 'Plan'} · {requests.length} pending</T.BodyMd>
      </ScreenPad>
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={{ padding: spacing.lg, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
            <Row gap="md" align="flex-start" style={{ marginBottom: spacing.md }}>
              <Pressable onPress={() => navigation.navigate('ProfileOther', { userId: item.id })} hitSlop={HIT_SLOP.sm} accessibilityRole="button">
                <Avatar uri={item.avatarUri} name={item.name} size={avatarSizes.lg} shape="circle" />
              </Pressable>
              <Stack style={{ flex: 1 }}>
                <Pressable onPress={() => navigation.navigate('ProfileOther', { userId: item.id })} hitSlop={HIT_SLOP.sm}>
                  <T.LabelLg>{item.name}</T.LabelLg>
                </Pressable>
                <Row gap="sm" wrap style={{ marginTop: spacing.sm }}>
                  <TrustPill label={item.attendanceScore !== null ? `${item.attendanceScore}% attendance` : 'New'} tone="green" />
                  <TrustPill label={`${item.plansAttended} plans joined`} />
                </Row>
              </Stack>
            </Row>
            <Row gap="sm">
              <Pressable
                onPress={() => decide(item.id, true)}
                disabled={busyId === item.id}
                accessibilityRole="button" accessibilityLabel={`Approve ${item.name}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 11, borderRadius: radii.sm, backgroundColor: colors.coral }}
              >
                <Icon name="check" size={iconSizes.xs} color={colors.white} strokeWidth={2.5} />
                <T.LabelMd color={colors.white}>Approve</T.LabelMd>
              </Pressable>
              <Pressable
                onPress={() => decide(item.id, false)}
                disabled={busyId === item.id}
                accessibilityRole="button" accessibilityLabel={`Decline ${item.name}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 11, borderRadius: radii.sm, backgroundColor: colors.surface, borderWidth: borderWidths.medium, borderColor: colors.border }}
              >
                <Icon name="x" size={iconSizes.xs} color={colors.textSub} />
                <T.LabelMd>Decline</T.LabelMd>
              </Pressable>
            </Row>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            {loading ? <ActivityIndicator color={colors.coral} /> : <T.BodyMd color={colors.textSub}>No pending requests.</T.BodyMd>}
          </View>
        }
      />
    </Screen>
  );
}
