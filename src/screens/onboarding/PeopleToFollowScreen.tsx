import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { AVATARS } from '@/mocks';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'PeopleToFollow'>;

interface Suggested { id: string; avatarUri: string; name: string; handle: string; mutual: number; }

const SUGGESTED: Suggested[] = [
  { id: 'sug0', avatarUri: AVATARS.av2, name: 'Priya K', handle: '@priya_runs', mutual: 3 },
  { id: 'sug1', avatarUri: AVATARS.av1, name: 'Arjun R', handle: '@arjun.blr', mutual: 2 },
  { id: 'sug2', avatarUri: AVATARS.av3, name: 'Kiran B', handle: '@kiran.b', mutual: 5 },
  { id: 'sug3', avatarUri: AVATARS.av4, name: 'Sneha P', handle: '@sneha.p', mutual: 1 },
  { id: 'sug4', avatarUri: AVATARS.av5, name: 'Dev A', handle: '@dev.codes', mutual: 4 },
];

export function PeopleToFollowScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setFollowing((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => navigation.goBack()} />
    </View>
  );

  const footer = (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: 1, gap: 8, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button variant="primary-coral" label="Continue" onPress={() => navigation.navigate('Neighbourhood')} />
      <Pressable onPress={() => navigation.navigate('Neighbourhood')} style={{ alignSelf: 'center', padding: spacing.xs }} hitSlop={8}>
        <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.textSub }}>Skip</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: 4, paddingBottom: 20 }}>
        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 6, color: colors.text }}>People you may know</Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>Follow people to see their plans and build your feed.</Text>
      </View>
      <FlatList
        data={SUGGESTED}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const isFollowing = following.has(item.id);
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: spacing.screenPx, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Avatar uri={item.avatarUri} name={item.name} size={44} shape="circle" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14, color: colors.text }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, marginTop: 1, color: colors.textSub }} numberOfLines={1}>{item.handle}</Text>
                <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, marginTop: 1, color: colors.textDim }} numberOfLines={1}>{item.mutual} mutual connection{item.mutual === 1 ? '' : 's'}</Text>
              </View>
              <Pressable
                onPress={() => toggle(item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: radii.sm, backgroundColor: isFollowing ? colors.cost.freeBg : colors.coral, borderColor: isFollowing ? colors.cost.freeFg : colors.coral }}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? `Unfollow ${item.name}` : `Follow ${item.name}`}
              >
                {isFollowing ? <Icon name="check" size={11} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                <Text style={{ fontFamily: fontFamilies.bold, fontSize: 12, color: isFollowing ? colors.cost.freeFg : colors.white }}>{isFollowing ? 'Following' : 'Follow'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </Screen>
  );
}
