import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
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
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsBlocked'>;

type BlockedUser = { id: string; name: string; handle: string; avatarUri?: string };

export function SettingsBlockedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

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
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Row gap="md" style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <View style={{ opacity: 0.6 }}>
                  <Avatar uri={item.avatarUri} name={item.name} size={avatarSizes.md} shape="circle" />
                </View>
                <Stack gap={1} style={{ flex: 1 }}>
                  <T.Semibold>{item.name}</T.Semibold>
                  <T.Meta>{item.handle}</T.Meta>
                  <T.MetaXs>Blocked</T.MetaXs>
                </Stack>
                <Pressable
                  onPress={() => { setBlocked((b) => b.filter((u) => u.id !== item.id)); toast.show('Unblocked'); }}
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
