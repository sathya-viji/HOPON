import React, { useState } from 'react';
import { FlatList } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { TrustPill } from '@/components/atoms/TrustPill';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes } from '@/theme/tokens';
import { users, getUserById, CURRENT_USER_ID } from '@/mocks';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'FamiliarFaces'>;

export function FamiliarFacesScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const me = getUserById(CURRENT_USER_ID)!;
  const faces = me.familiarFaceIds.map((id) => getUserById(id)).filter(Boolean);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

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
        data={faces as typeof users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ProfileOther', { userId: item.id })}
            style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
          >
            <Row gap="md" style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.screenPx }}>
              <Avatar uri={item.avatarUri} name={item.name} size={avatarSizes.lg} shape="circle" />
              <Stack style={{ flex: 1, minWidth: 0 }} gap={3}>
                <T.LabelLg>{item.name}</T.LabelLg>
                <T.Meta style={{ marginBottom: spacing.sm }}>{item.handle}</T.Meta>
                <Row gap="sm" wrap>
                  <TrustPill label="2 plans together" tone="green" />
                  <TrustPill label="Last met 3d ago" />
                </Row>
              </Stack>
              <Pressable
                onPress={() => setFollowingSet((s) => { const n = new Set(s); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  paddingVertical: spacing.sm - 2, paddingHorizontal: spacing.lg - 2,
                  borderWidth: borderWidths.medium, borderRadius: radii.sm,
                  backgroundColor: followingSet.has(item.id) ? colors.cost.freeBg : colors.coral,
                  borderColor: followingSet.has(item.id) ? colors.cost.freeFg : colors.coral,
                }}
              >
                {followingSet.has(item.id) ? <Icon name="check" size={iconSizes.xxs + 1} color={colors.cost.freeFg} strokeWidth={2.5} /> : null}
                <T.LabelMd color={followingSet.has(item.id) ? colors.cost.freeFg : colors.white}>
                  {followingSet.has(item.id) ? 'Following' : 'Follow'}
                </T.LabelMd>
              </Pressable>
            </Row>
          </Pressable>
        )}
      />
    </Screen>
  );
}
