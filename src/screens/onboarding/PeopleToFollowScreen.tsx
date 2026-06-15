import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { matchContacts, type ContactSyncStatus } from '@/api/contacts';
import { followUser, type FollowState } from '@/api/follows';
import type { User } from '@/types';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'PeopleToFollow'>;

export function PeopleToFollowScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const sync = route.params?.sync ?? false;

  const [loading, setLoading] = useState(sync);
  const [status, setStatus] = useState<ContactSyncStatus | 'skip'>(sync ? 'matched' : 'skip');
  const [people, setPeople] = useState<User[]>([]);
  const [state, setState] = useState<Record<string, FollowState>>({}); // userId → follow state

  useEffect(() => {
    if (!sync) return;
    let cancelled = false;
    matchContacts().then((res) => {
      if (cancelled) return;
      setPeople(res.users);
      setStatus(res.status);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [sync]);

  const toggle = async (u: User) => {
    const cur = state[u.id] ?? 'none';
    // optimistic
    setState((p) => ({ ...p, [u.id]: cur === 'none' ? 'accepted' : 'none' }));
    try {
      if (cur === 'none') {
        const s = await followUser(u.id);
        setState((p) => ({ ...p, [u.id]: s }));
      } else {
        // unfollow on toggle-off (rare during onboarding) — keep it simple: leave followed
        setState((p) => ({ ...p, [u.id]: cur }));
      }
    } catch {
      setState((p) => ({ ...p, [u.id]: cur })); // revert
    }
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

  const emptyCopy = (): { title: string; sub: string } => {
    switch (status) {
      case 'denied': return { title: 'Contacts not shared', sub: 'No problem — you can find people anytime from Search. Turn on contacts later in Settings.' };
      case 'no_contacts': return { title: 'No contacts found', sub: 'We couldn’t read any contacts. You can find people anytime from Search.' };
      case 'error': return { title: 'Couldn’t sync contacts', sub: 'Something went wrong. You can try again later from Settings.' };
      default: return { title: 'No one yet', sub: 'None of your contacts are on hopon yet — you can find people anytime from Search.' };
    }
  };

  return (
    <Screen header={header} footer={footer} scroll={false}>
      <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: 4, paddingBottom: 20 }}>
        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 6, color: colors.text }}>People you may know</Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
          {sync ? 'Contacts already on hopon. Follow people to build your feed.' : 'Follow people to see their plans and build your feed.'}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, marginTop: spacing.md, color: colors.textSub }}>Looking for friends on hopon…</Text>
        </View>
      ) : people.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, gap: 8 }}>
          <Icon name="users" size={40} color={colors.textDim} />
          <Text style={{ fontFamily: fontFamilies.bold, fontSize: 16, color: colors.text, textAlign: 'center' }}>{emptyCopy().title}</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 13 * 1.6 }}>{emptyCopy().sub}</Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => {
            const fs = state[item.id] ?? 'none';
            const active = fs !== 'none';
            const label = fs === 'pending' ? 'Requested' : fs === 'accepted' ? 'Following' : 'Follow';
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: spacing.screenPx, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Avatar uri={item.avatarUri} name={item.name} size={44} shape="circle" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14, color: colors.text }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, marginTop: 1, color: colors.textSub }} numberOfLines={1}>{item.handle} · {item.neighbourhood}</Text>
                </View>
                <Pressable
                  onPress={() => toggle(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: radii.sm, backgroundColor: active ? colors.cost.freeBg : colors.coral, borderColor: active ? colors.cost.freeFg : colors.coral }}
                  accessibilityRole="button"
                  accessibilityLabel={active ? `Following ${item.name}` : `Follow ${item.name}`}
                >
                  {fs === 'accepted' ? <Icon name="check" size={11} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                  <Text style={{ fontFamily: fontFamilies.bold, fontSize: 12, color: active ? colors.cost.freeFg : colors.white }}>{label}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
