import React, { useState, useEffect } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { TrustPill } from '@/components/atoms/TrustPill';
import { EmptyState } from '@/components/atoms/EmptyState';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes } from '@/theme/tokens';
import { getFamiliarFaces, type FamiliarFace } from '@/api/trust';
import { timeAgo } from '@/utils/time';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'FamiliarFaces'>;

export function FamiliarFacesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [faces, setFaces] = useState<FamiliarFace[]>([]);
  const [loading, setLoading] = useState(true);
  // Follow is a local toggle for now — real follow/unfollow lands in the Social wave.
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getFamiliarFaces()
      .then((f) => { if (!cancelled) setFaces(f); })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Screen header={<ScreenHeader title="Familiar Faces" onBack={() => navigation.goBack()} />} scroll={false}>
      <Row
        gap="sm"
        align="flex-start"
        style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.md, backgroundColor: colors.cost.freeBg, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
      >
        <Icon name="info" size={iconSizes.sm} color={colors.green} />
        <T.Meta color={colors.cost.freeFg} style={{ flex: 1 }}>
          People you've crossed paths with through hopon. Your social graph, built through real plans.
        </T.Meta>
      </Row>
      <SectionHeader label="YOUR NETWORK" count={faces.length} />
      <FlatList
        data={faces}
        keyExtractor={(f) => f.user.id}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : (
            <EmptyState emoji="👥" title="No familiar faces yet" sub="Attend a plan and the people you meet show up here." />
          )
        }
        renderItem={({ item }) => {
          const u = item.user;
          return (
            <Pressable
              onPress={() => navigation.navigate('ProfileOther', { userId: u.id })}
              style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
            >
              <Row gap="md" style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.screenPx }}>
                <Avatar uri={u.avatarUri} name={u.name} size={avatarSizes.lg} shape="circle" />
                <Stack style={{ flex: 1, minWidth: 0 }} gap={3}>
                  <T.LabelLg>{u.name}</T.LabelLg>
                  <T.Meta style={{ marginBottom: spacing.sm }}>{u.handle}</T.Meta>
                  <Row gap="sm" wrap>
                    <TrustPill label={`${item.plansTogether} plan${item.plansTogether > 1 ? 's' : ''} together`} tone="green" />
                    <TrustPill label={`Last met ${timeAgo(item.lastMetAt)}`} />
                  </Row>
                </Stack>
                <Pressable
                  onPress={() => setFollowingSet((s) => { const n = new Set(s); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                    paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg - 2,
                    borderWidth: borderWidths.medium, borderRadius: radii.sm,
                    backgroundColor: followingSet.has(u.id) ? colors.cost.freeBg : colors.coral,
                    borderColor: followingSet.has(u.id) ? colors.cost.freeFg : colors.coral,
                  }}
                >
                  {followingSet.has(u.id) ? <Icon name="check" size={iconSizes.xxs + 1} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                  <T.LabelMd color={followingSet.has(u.id) ? colors.cost.freeFg : colors.white}>
                    {followingSet.has(u.id) ? 'Following' : 'Follow'}
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
