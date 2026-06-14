import React, { useState } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { Tap } from '@/components/atoms/Tap';
import { Image } from 'expo-image';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, fontFamilies } from '@/theme/tokens';
import { recaps, getUserById } from '@/mocks';
import { timeAgo } from '@/utils/time';
import { useToast } from '@/hooks/useToast';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'RecapDetail'>;

interface LocalComment { id: string; authorId: string; text: string; createdAt: string; }
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const SEED_COMMENTS: LocalComment[] = [
  { id: 'c0', authorId: 'u1', text: 'Such a good morning for a run! 🌅', createdAt: minsAgo(20) },
  { id: 'c1', authorId: 'u3', text: 'What route did you take?', createdAt: minsAgo(18) },
  { id: 'c2', authorId: 'u2', text: '@kiran.b Started at the main gate, 5k loop', createdAt: minsAgo(15) },
  { id: 'c3', authorId: 'u4', text: 'Wish I was there! Next time 🙏', createdAt: minsAgo(10) },
  { id: 'c4', authorId: 'u5', text: 'The weather really was perfect yesterday', createdAt: minsAgo(5) },
];

export function RecapDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const recap = recaps.find((r) => r.id === route.params.recapId) ?? recaps[0];
  const author = getUserById(recap.authorId);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<LocalComment[]>(SEED_COMMENTS);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    setComments((c) => [...c, { id: `c-${Date.now()}`, authorId: 'u0', text: draft.trim(), createdAt: new Date().toISOString() }]);
    setDraft('');
    toast.show('Comment posted');
  };

  const header = (
    <ScreenPad>
      <Row gap="sm" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Spacer flex />
        <Tap onPress={() => navigation.navigate('ProfileOther', { userId: recap.authorId })} hitSlop={spacing.sm}>
          <Icon name="user" size={iconSizes.md} color={colors.textDim} />
        </Tap>
        <Tap onPress={() => toast.show('Share')} hitSlop={spacing.sm}>
          <Icon name="share-2" size={iconSizes.md} color={colors.textDim} />
        </Tap>
      </Row>
    </ScreenPad>
  );

  const footer = (
    <Row gap="sm" style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, paddingBottom: spacing.lg + 4, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      <Row style={{ flex: 1, borderWidth: borderWidths.medium, borderRadius: radii.xxl, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, borderColor: colors.border, backgroundColor: colors.surface }}>
        <RNTextInput
          style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 14, color: colors.text, padding: 0 }}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textDim}
          returnKeyType="send"
          onSubmitEditing={submit}
        />
      </Row>
      <Tap onPress={submit} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg }}>
        <Icon name="send" size={iconSizes.sm} color={colors.ctaFg} />
      </Tap>
    </Row>
  );

  return (
    <Screen header={header} footer={footer}>
      <Image source={{ uri: recap.imageUri }} style={{ width: '100%', aspectRatio: 4 / 5 }} contentFit="cover" />

      <ScreenPad style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
        <Row gap="md">
          <Tap onPress={() => navigation.navigate('ProfileOther', { userId: recap.authorId })}>
            <Avatar uri={author?.avatarUri} name={author?.name} size={40} shape="circle" />
          </Tap>
          <Tap style={{ flex: 1 }} onPress={() => navigation.navigate('ProfileOther', { userId: recap.authorId })}>
            <Stack>
              <T.LabelMd>{author?.name}</T.LabelMd>
              <T.MetaXs>{author?.handle} · {timeAgo(recap.createdAt)}</T.MetaXs>
            </Stack>
          </Tap>
          <Tap
            onPress={() => setFollowing((v) => !v)}
            style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderWidth: borderWidths.medium, borderRadius: radii.sm, backgroundColor: following ? colors.cost.freeBg : colors.coral, borderColor: following ? colors.cost.freeFg : colors.coral }}
          >
            <T.LabelXs color={following ? colors.cost.freeFg : colors.white}>{following ? 'Following' : 'Follow'}</T.LabelXs>
          </Tap>
        </Row>
      </ScreenPad>

      <ScreenPad style={{ paddingBottom: spacing.md }}>
        <T.BodyLg><T.Bold>{author?.name} </T.Bold>{recap.caption}</T.BodyLg>
      </ScreenPad>

      <Row gap="lg" style={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.md, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <Tap onPress={() => setLiked((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="heart" size={20} color={liked ? colors.coral : colors.textSub} strokeWidth={liked ? 2.5 : 1.75} />
          <T.Semibold color={liked ? colors.coral : colors.textSub}>{recap.likeCount + (liked ? 1 : 0)}</T.Semibold>
        </Tap>
        <Row style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="message-circle" size={20} color={colors.textSub} />
          <T.Semibold color={colors.textSub}>{comments.length}</T.Semibold>
        </Row>
        <Tap onPress={() => toast.show('Share')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="share-2" size={20} color={colors.textSub} />
        </Tap>
      </Row>

      {comments.length === 0 ? (
        <EmptyState emoji="💬" title="No comments yet" sub="Be the first to say something." />
      ) : (
        comments.map((item) => {
          const a = getUserById(item.authorId);
          return (
            <Row key={item.id} gap="sm" style={{ paddingVertical: spacing.md - 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}>
              <Avatar uri={a?.avatarUri} name={a?.name} size={32} shape="circle" />
              <Stack style={{ flex: 1 }}>
                <Row gap="sm" align="baseline" style={{ marginBottom: 3 }}>
                  <T.LabelSm>{a?.name}</T.LabelSm>
                  <T.MetaXs color={colors.textDim}>{timeAgo(item.createdAt)}</T.MetaXs>
                </Row>
                <T.BodyMd>{item.text}</T.BodyMd>
              </Stack>
            </Row>
          );
        })
      )}

      <Spacer size="md" />
    </Screen>
  );
}
