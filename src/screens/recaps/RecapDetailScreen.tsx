import React, { useCallback, useState } from 'react';
import { TextInput as RNTextInput, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
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
import { timeAgo } from '@/utils/time';
import { useToast } from '@/hooks/useToast';
import { useFocusResource } from '@/api/hooks/useFocusResource';
import {
  getRecapDetail, likeRecap, unlikeRecap, commentRecap, deleteComment, deleteRecap,
  type RecapDetail,
} from '@/api/recaps';
import { getFollowState, followUser, unfollow, type FollowState } from '@/api/follows';
import { submitReport, type ReportReasonValue } from '@/api/safety';
import { supabase } from '@/api/client';
import { errorMessage } from '@/api/errors';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'RecapDetail'>;

interface Loaded {
  detail: RecapDetail;
  followState: FollowState;
  myUid: string | null;
}

const REPORT_REASONS: { label: string; value: ReportReasonValue }[] = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Inappropriate content', value: 'inappropriate_content' },
  { label: 'Other', value: 'other' },
];

export function RecapDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const recapId = route.params.recapId;

  const load = useCallback(async (): Promise<Loaded> => {
    const detail = await getRecapDetail(recapId);
    const { data: { session } } = await supabase.auth.getSession();
    const myUid = session?.user?.id ?? null;
    const followState = detail.recap.authorId && detail.recap.authorId !== myUid
      ? await getFollowState(detail.recap.authorId).catch(() => 'none' as FollowState)
      : 'none';
    return { detail, followState, myUid };
  }, [recapId]);

  const { data, loading, error, refetch, set } = useFocusResource(load, [recapId]);

  const [liked, setLiked] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const detail = data?.detail;
  const recap = detail?.recap;
  const author = recap?.author;
  const myUid = data?.myUid ?? null;
  const isMine = !!(recap && myUid && recap.authorId === myUid);
  const isLiked = liked ?? recap?.likedByMe ?? false;
  const likeCount = (recap?.likeCount ?? 0) + (isLiked && !(recap?.likedByMe) ? 1 : 0) - (!isLiked && recap?.likedByMe ? 1 : 0);

  const toggleLike = useCallback(async () => {
    if (!recap) return;
    const next = !isLiked;
    setLiked(next);
    try {
      if (next) await likeRecap(recap.id); else await unlikeRecap(recap.id);
    } catch (e) {
      setLiked(!next);
      toast.show(errorMessage(e, 'Couldn’t update like.'));
    }
  }, [recap, isLiked, toast]);

  const toggleFollow = useCallback(async () => {
    if (!recap || followBusy || !data) return;
    setFollowBusy(true);
    const cur = data.followState;
    try {
      if (cur === 'none') {
        const s = await followUser(recap.authorId);
        set({ ...data, followState: s });
        toast.show(s === 'pending' ? 'Follow request sent' : 'Following');
      } else {
        await unfollow(recap.authorId);
        set({ ...data, followState: 'none' });
      }
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t update follow.'));
    } finally {
      setFollowBusy(false);
    }
  }, [recap, followBusy, data, set, toast]);

  const submitComment = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await commentRecap(recapId, body);
      setDraft('');
      refetch();
      toast.show('Comment posted');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t post comment.'));
    } finally {
      setPosting(false);
    }
  }, [draft, posting, recapId, refetch, toast]);

  const report = useCallback((target: 'recap' | 'comment', id: string) => {
    Alert.alert(
      target === 'recap' ? 'Report this recap' : 'Report this comment',
      'Why are you reporting it?',
      [
        ...REPORT_REASONS.map((r) => ({
          text: r.label,
          onPress: async () => {
            try {
              await submitReport(target, id, r.value);
              toast.show('Thanks — our team will review this.');
            } catch (e) {
              toast.show(errorMessage(e, 'Couldn’t submit report.'));
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [toast]);

  const onRecapMenu = useCallback(() => {
    if (!recap) return;
    if (isMine) {
      Alert.alert('Your recap', undefined, [
        { text: 'Delete recap', style: 'destructive', onPress: async () => {
          try { await deleteRecap(recap.id); toast.show('Recap deleted'); navigation.goBack(); }
          catch (e) { toast.show(errorMessage(e, 'Couldn’t delete.')); }
        } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      report('recap', recap.id);
    }
  }, [recap, isMine, report, toast, navigation]);

  const onCommentLong = useCallback((commentId: string, commentAuthorId: string) => {
    const mine = myUid && commentAuthorId === myUid;
    Alert.alert(
      'Comment',
      undefined,
      mine
        ? [
            { text: 'Delete comment', style: 'destructive' as const, onPress: async () => {
              try { await deleteComment(commentId); refetch(); } catch (e) { toast.show(errorMessage(e, 'Couldn’t delete.')); }
            } },
            { text: 'Cancel', style: 'cancel' as const },
          ]
        : [
            { text: 'Report comment', onPress: () => report('comment', commentId) },
            { text: 'Cancel', style: 'cancel' as const },
          ],
    );
  }, [myUid, refetch, report, toast]);

  const header = (
    <ScreenPad>
      <Row gap="sm" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Spacer flex />
        {author ? (
          <Tap onPress={() => navigation.navigate('ProfileOther', { userId: author.id })} hitSlop={spacing.sm}>
            <Icon name="user" size={iconSizes.md} color={colors.textDim} />
          </Tap>
        ) : null}
        {recap ? (
          <Tap onPress={onRecapMenu} hitSlop={spacing.sm}>
            <Icon name={isMine ? 'more-horizontal' : 'flag'} size={iconSizes.md} color={colors.textDim} />
          </Tap>
        ) : null}
      </Row>
    </ScreenPad>
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
  if (error || !detail || !recap) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="🔍" title="Recap unavailable" sub="It may have been removed or is no longer visible to you." />
      </Screen>
    );
  }

  const images = recap.imageUris && recap.imageUris.length > 0 ? recap.imageUris : [recap.imageUri];
  const followState = data?.followState ?? 'none';

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
          onSubmitEditing={submitComment}
        />
      </Row>
      <Tap onPress={submitComment} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg, opacity: posting ? 0.6 : 1 }}>
        <Icon name="send" size={iconSizes.sm} color={colors.ctaFg} />
      </Tap>
    </Row>
  );

  return (
    <Screen header={header} footer={footer}>
      {/* Image carousel (1–5) */}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width, aspectRatio: 4 / 5 }} contentFit="cover" />
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <Row gap={5} style={{ position: 'absolute', bottom: spacing.sm, alignSelf: 'center' }}>
                {images.map((_, i) => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? colors.white : 'rgba(255,255,255,0.5)' }} />
                ))}
              </Row>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScreenPad style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
        <Row gap="md">
          <Tap onPress={() => author && navigation.navigate('ProfileOther', { userId: author.id })}>
            <Avatar uri={author?.avatarUri} name={author?.name} size={40} shape="circle" />
          </Tap>
          <Tap style={{ flex: 1 }} onPress={() => author && navigation.navigate('ProfileOther', { userId: author.id })}>
            <Stack>
              <T.LabelMd>{author?.name ?? 'Member'}</T.LabelMd>
              <T.MetaXs>{author?.handle ?? ''}{author ? ' · ' : ''}{timeAgo(recap.createdAt)}</T.MetaXs>
            </Stack>
          </Tap>
          {!isMine && author ? (
            <Tap
              onPress={toggleFollow}
              style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderWidth: borderWidths.medium, borderRadius: radii.sm, opacity: followBusy ? 0.6 : 1, backgroundColor: followState !== 'none' ? colors.cost.freeBg : colors.coral, borderColor: followState !== 'none' ? colors.cost.freeFg : colors.coral }}
            >
              <T.LabelXs color={followState !== 'none' ? colors.cost.freeFg : colors.white}>
                {followState === 'accepted' ? 'Following' : followState === 'pending' ? 'Requested' : 'Follow'}
              </T.LabelXs>
            </Tap>
          ) : null}
        </Row>
      </ScreenPad>

      {recap.caption ? (
        <ScreenPad style={{ paddingBottom: spacing.md }}>
          <T.BodyLg><T.Bold>{author?.name} </T.Bold>{recap.caption}</T.BodyLg>
        </ScreenPad>
      ) : null}

      <Row gap="lg" style={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.md, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <Tap onPress={toggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="heart" size={20} color={isLiked ? colors.coral : colors.textSub} strokeWidth={isLiked ? 2.5 : 1.75} />
          <T.Semibold color={isLiked ? colors.coral : colors.textSub}>{Math.max(0, likeCount)}</T.Semibold>
        </Tap>
        <Row style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="message-circle" size={20} color={colors.textSub} />
          <T.Semibold color={colors.textSub}>{detail.comments.length}</T.Semibold>
        </Row>
      </Row>

      {detail.comments.length === 0 ? (
        <EmptyState emoji="💬" title="No comments yet" sub="Be the first to say something." />
      ) : (
        detail.comments.map((c) => (
          <Tap key={c.id} onLongPress={() => !c.isDeleted && onCommentLong(c.id, c.authorId)}>
            <Row gap="sm" style={{ paddingVertical: spacing.md - 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}>
              <Avatar uri={c.authorAvatarUri} name={c.authorName} size={32} shape="circle" />
              <Stack style={{ flex: 1 }}>
                <Row gap="sm" align="baseline" style={{ marginBottom: 3 }}>
                  <T.LabelSm>{c.isDeleted ? 'Member' : c.authorName}</T.LabelSm>
                  <T.MetaXs color={colors.textDim}>{timeAgo(c.createdAt)}</T.MetaXs>
                </Row>
                <T.BodyMd color={c.isDeleted ? colors.textDim : colors.text}>{c.isDeleted ? 'This comment was deleted' : c.body}</T.BodyMd>
              </Stack>
            </Row>
          </Tap>
        ))
      )}

      <Spacer size="md" />
    </Screen>
  );
}
