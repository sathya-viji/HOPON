import React from 'react';
import { Pressable } from 'react-native';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, iconSizes, avatarSizes, HIT_SLOP } from '@/theme/tokens';
import type { User } from '@/types';

/**
 * Person result row for People search (no prototype equivalent — built from the
 * design-system atoms: circle Avatar + name + verified badge + @handle/area).
 * Shared by the Home inline search and the dedicated Search screen.
 */
export function PersonRow({ user, onPress }: { user: User; onPress: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(user.id)}
      hitSlop={HIT_SLOP.sm}
      accessibilityRole="button"
      accessibilityLabel={`${user.name} profile`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
    >
      <Avatar uri={user.avatarUri} name={user.name} size={avatarSizes.lg} shape="circle" />
      <Stack style={{ flex: 1 }}>
        <Row gap="xs" align="center">
          <T.LabelMd numberOfLines={1}>{user.name}</T.LabelMd>
          {user.isVerified ? <Icon name="badge-check" size={14} color={colors.green} strokeWidth={2.5} /> : null}
        </Row>
        <T.MetaXs numberOfLines={1}>
          {user.handle}{user.neighbourhood ? ` · ${user.neighbourhood}` : ''}
        </T.MetaXs>
      </Stack>
      <Icon name="chevron-right" size={iconSizes.sm} color={colors.textDim} />
    </Pressable>
  );
}
