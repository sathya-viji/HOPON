import React from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths } from '@/theme/tokens';
import { getUserById } from '@/mocks';
import { timeAgo } from '@/utils/time';
import { Recap } from '@/types';

interface RecapCardProps {
  recap: Recap;
  onPress: () => void;
}

export function RecapCard({ recap, onPress }: RecapCardProps) {
  const { colors } = useTheme();
  // Prefer the author embedded by the backend feed; fall back to the mock
  // lookup for any remaining mock-driven callers.
  const author = recap.author ?? getUserById(recap.authorId);
  return (
    <Pressable onPress={onPress} style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border, paddingBottom: spacing.sm + 2 }}>
      <Image source={{ uri: recap.imageUri }} style={{ width: '100%', aspectRatio: 4 / 5 }} contentFit="cover" />
      <Stack gap="sm" style={{ paddingHorizontal: spacing.screenPx, paddingTop: spacing.md - 2 }}>
        <Row gap="sm">
          <Avatar uri={author?.avatarUri} name={author?.name} size={32} shape="circle" />
          <Stack style={{ flex: 1 }}>
            <T.LabelMd numberOfLines={1}>{author?.name}</T.LabelMd>
            <T.MetaXs numberOfLines={1}>@{author?.handle.replace('@', '')} · {timeAgo(recap.createdAt)}</T.MetaXs>
          </Stack>
        </Row>
        {recap.caption ? (
          <T.BodyLg numberOfLines={3}><T.Bold>{author?.name}</T.Bold> {recap.caption}</T.BodyLg>
        ) : null}
        <Row gap="lg" style={{ marginTop: spacing.xs }}>
          <Row gap="sm">
            <Icon name="heart" size={18} color={colors.textSub} />
            <T.Semibold color={colors.textSub}>{recap.likeCount}</T.Semibold>
          </Row>
          <Row gap="sm">
            <Icon name="message-circle" size={18} color={colors.textSub} />
            <T.Semibold color={colors.textSub}>{recap.commentCount}</T.Semibold>
          </Row>
        </Row>
      </Stack>
    </Pressable>
  );
}
