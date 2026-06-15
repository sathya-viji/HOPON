import React, { useCallback } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, avatarSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { useFocusResource } from '@/api/hooks/useFocusResource';
import { getBlockedUsers, unblockUser, type BlockedEntry } from '@/api/safety';
import { errorMessage } from '@/api/errors';
import { timeAgo } from '@/utils/time';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsBlocked'>;

// NOTE: blocked users are filtered out of users_public, so their name/avatar
// can't be resolved client-side — entries show a generic label with an unblock
// action. (Resolving names would need a dedicated read RPC; documented gap.)
export function SettingsBlockedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { data, loading, refreshing, refetch } = useFocusResource(getBlockedUsers);

  const unblock = useCallback(async (userId: string) => {
    try { await unblockUser(userId); toast.show('Unblocked'); refetch(); }
    catch (e) { toast.show(errorMessage(e, 'Couldn’t unblock.')); }
  }, [refetch, toast]);

  const blocked = data ?? [];

  if (loading) {
    return (
      <Screen header={<ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} />} scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} />} scroll={false}>
      {blocked.length === 0 ? (
        <EmptyState emoji="🚫" title="No blocked users" sub="People you block can't see your plans or profile, and won't appear in your feed." />
      ) : (
        <>
          <ScreenPad style={{ paddingVertical: spacing.sm + 2, backgroundColor: colors.surface, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
            <T.Meta>{blocked.length} blocked user{blocked.length === 1 ? '' : 's'} · They can't see your plans or profile.</T.Meta>
          </ScreenPad>
          <FlatList
            data={blocked}
            keyExtractor={(b: BlockedEntry) => b.userId}
            refreshing={refreshing}
            onRefresh={refetch}
            renderItem={({ item }) => (
              <Row gap="md" style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <View style={{ opacity: 0.6 }}>
                  <Avatar name="?" size={avatarSizes.md} shape="circle" />
                </View>
                <Stack gap={1} style={{ flex: 1 }}>
                  <T.Semibold>Blocked member</T.Semibold>
                  <T.MetaXs>Blocked {timeAgo(item.blockedAt)}</T.MetaXs>
                </Stack>
                <Pressable
                  onPress={() => unblock(item.userId)}
                  style={{ paddingVertical: spacing.sm - 1, paddingHorizontal: spacing.lg, borderWidth: borderWidths.medium, borderRadius: radii.sm, borderColor: colors.border, backgroundColor: colors.surface }}
                >
                  <T.LabelMd color={colors.textSub}>Unblock</T.LabelMd>
                </Pressable>
              </Row>
            )}
          />
        </>
      )}
    </Screen>
  );
}
