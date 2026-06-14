import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { TabBar } from '@/components/molecules/TabBar';
import { Avatar } from '@/components/atoms/Avatar';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, avatarSizes } from '@/theme/tokens';
import { users } from '@/mocks';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'FollowList'>;

export function FollowListScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'followers' | 'following'>(route.params.tab);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set(['u1', 'u2']));

  const list = tab === 'followers' ? users.slice(1, 5) : users.slice(1).filter((u) => followingSet.has(u.id));
  const profileUser = users.find((u) => u.id === route.params.userId);

  const header = (
    <View>
      <ScreenHeader title={profileUser?.name ?? 'Follow list'} onBack={() => navigation.goBack()} />
      <TabBar
        tabs={[
          { id: 'followers', label: `Followers · ${users.slice(1, 5).length}` },
          { id: 'following', label: `Following · ${followingSet.size}` },
        ]}
        active={tab}
        onSelect={(id) => setTab(id as 'followers' | 'following')}
      />
    </View>
  );

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const isFollowing = followingSet.has(item.id);
          return (
            <Pressable
              onPress={() => navigation.navigate('ProfileOther', { userId: item.id })}
              style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
            >
              <Row gap="md" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.screenPx }}>
                <Avatar uri={item.avatarUri} name={item.name} size={44} shape="circle" />
                <Stack gap={2} style={{ flex: 1 }}>
                  <T.LabelLg>{item.name}</T.LabelLg>
                  <T.Meta>{item.handle}</T.Meta>
                </Stack>
                <Pressable
                  onPress={() => setFollowingSet((s) => { const n = new Set(s); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                  style={{
                    paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg - 2,
                    borderWidth: borderWidths.medium, borderRadius: radii.sm,
                    backgroundColor: isFollowing ? colors.cost.freeBg : colors.coral,
                    borderColor: isFollowing ? colors.cost.freeFg : colors.coral,
                  }}
                >
                  <T.LabelMd color={isFollowing ? colors.cost.freeFg : colors.white}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </T.LabelMd>
                </Pressable>
              </Row>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
