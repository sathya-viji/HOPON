import React, { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { TabBar } from '@/components/molecules/TabBar';
import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii } from '@/theme/tokens';
import { useFocusResource } from '@/api/hooks/useFocusResource';
import {
  getMyFollowers, getMyFollowing, acceptFollow, declineFollow, unfollow, followUser,
  type FollowEntry, type FollowState,
} from '@/api/follows';
import { supabase } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'FollowList'>;

interface Loaded {
  followers: FollowEntry[];
  following: FollowEntry[];
  isSelf: boolean;
}

export function FollowListScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const userId = route.params.userId;
  const [tab, setTab] = useState<'followers' | 'following'>(route.params.tab);

  const load = useCallback(async (): Promise<Loaded> => {
    const { data: { session } } = await supabase.auth.getSession();
    const isSelf = session?.user?.id === userId;
    if (!isSelf) return { followers: [], following: [], isSelf: false };
    const [followers, following] = await Promise.all([getMyFollowers(), getMyFollowing()]);
    return { followers, following, isSelf: true };
  }, [userId]);

  const { data, loading, refreshing, refetch } = useFocusResource(load, [userId]);

  const accept = useCallback(async (id: string) => {
    try { await acceptFollow(id); toast.show('Request accepted'); refetch(); }
    catch (e) { toast.show(errorMessage(e, 'Couldn’t accept.')); }
  }, [refetch, toast]);

  const decline = useCallback(async (id: string) => {
    try { await declineFollow(id); refetch(); }
    catch (e) { toast.show(errorMessage(e, 'Couldn’t decline.')); }
  }, [refetch, toast]);

  const toggleFollow = useCallback(async (id: string, cur: FollowState) => {
    try {
      if (cur === 'none') { await followUser(id); } else { await unfollow(id); }
      refetch();
    } catch (e) { toast.show(errorMessage(e, 'Couldn’t update follow.')); }
  }, [refetch, toast]);

  const followers = data?.followers ?? [];
  const following = data?.following ?? [];
  const list = tab === 'followers' ? followers : following;

  const header = (
    <View>
      <ScreenHeader title={data?.isSelf ? 'Your network' : 'Follow list'} onBack={() => navigation.goBack()} />
      <TabBar
        tabs={[
          { id: 'followers', label: `Followers · ${followers.length}` },
          { id: 'following', label: `Following · ${following.length}` },
        ]}
        active={tab}
        onSelect={(id) => setTab(id as 'followers' | 'following')}
      />
    </View>
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

  if (data && !data.isSelf) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="🔒" title="This list is private" sub="You can only see your own followers and following." />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(e) => e.user.id}
        refreshing={refreshing}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            emoji={tab === 'followers' ? '👋' : '🔍'}
            title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            sub={tab === 'followers' ? 'People who follow you will appear here.' : 'Find people to follow from plans and recaps.'}
          />
        }
        renderItem={({ item }) => {
          const pending = item.status === 'pending';
          return (
            <Pressable
              onPress={() => navigation.navigate('ProfileOther', { userId: item.user.id })}
              style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
            >
              <Row gap="md" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.screenPx }}>
                <Avatar uri={item.user.avatarUri} name={item.user.name} size={44} shape="circle" />
                <Stack gap={2} style={{ flex: 1 }}>
                  <T.LabelLg>{item.user.name}</T.LabelLg>
                  <T.Meta>{item.user.handle}{pending ? ' · wants to follow you' : ''}</T.Meta>
                </Stack>
                {tab === 'followers' && pending ? (
                  <Row gap="sm">
                    <Pressable
                      onPress={() => accept(item.user.id)}
                      style={{ paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: colors.coral }}
                    >
                      <T.LabelMd color={colors.white}>Accept</T.LabelMd>
                    </Pressable>
                    <Pressable
                      onPress={() => decline(item.user.id)}
                      style={{ paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.md, borderWidth: borderWidths.medium, borderRadius: radii.sm, borderColor: colors.border }}
                    >
                      <T.LabelMd color={colors.textSub}>Decline</T.LabelMd>
                    </Pressable>
                  </Row>
                ) : tab === 'following' ? (
                  <Pressable
                    onPress={() => toggleFollow(item.user.id, item.status)}
                    style={{ paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg - 2, borderWidth: borderWidths.medium, borderRadius: radii.sm, backgroundColor: colors.cost.freeBg, borderColor: colors.cost.freeFg }}
                  >
                    <T.LabelMd color={colors.cost.freeFg}>{item.status === 'pending' ? 'Requested' : 'Following'}</T.LabelMd>
                  </Pressable>
                ) : null}
              </Row>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
