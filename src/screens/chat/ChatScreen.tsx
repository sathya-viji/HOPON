import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, FlatList, TextInput as RNTextInput, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Countdown } from '@/components/atoms/Countdown';
import { CostTag } from '@/components/atoms/CostTag';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, fontFamilies, CATEGORIES } from '@/theme/tokens';
import { supabase } from '@/api/client';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { getMessages, sendMessage, type ChatMessageRaw } from '@/api/chat';
import { subscribeToPlanMessages } from '@/api/realtime';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';
import { Message } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail, loading: planLoading, error } = usePlanDetail(planId);

  const [myUid, setMyUid] = useState<string | null>(null);
  const [raw, setRaw] = useState<ChatMessageRaw[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMyUid(data.session?.user.id ?? null));
  }, []);

  // History + live inserts. Dedupe by id (the send() echo and the realtime
  // broadcast can both deliver the same row).
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    getMessages(planId)
      .then((rows) => { if (!cancelled) setRaw(rows); })
      .catch(() => { /* offline — keep empty; user can retry by reopening */ })
      .finally(() => { if (!cancelled) setLoadingMsgs(false); });
    const unsub = subscribeToPlanMessages(planId, (m) =>
      setRaw((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
    );
    return () => { cancelled = true; unsub(); };
  }, [planId]);

  // Resolve author identity from the plan detail the screen already loads
  // (host + joiners). Recomputed when detail arrives so names fill in.
  const hostId = detail?.plan.hostId;
  const host = detail?.host;
  const joiners = detail?.joiners;
  const messages: Message[] = useMemo(
    () =>
      raw.map((m) => {
        const isHost = !!hostId && m.authorId === hostId;
        const j = joiners?.find((x) => x.id === m.authorId);
        return {
          id: m.id,
          planId: m.planId,
          authorId: m.authorId,
          authorName: isHost ? host?.name ?? 'Host' : j?.name ?? 'Member',
          authorAvatarUri: isHost ? host?.avatarUri : j?.avatarUri,
          isHost,
          body: m.isDeleted ? '[deleted]' : m.body,
          createdAt: m.createdAt,
        };
      }),
    [raw, hostId, host, joiners],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || !planId) return;
    setSending(true);
    try {
      const msg = await sendMessage(planId, body);
      setRaw((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t send. Check your connection.'));
    } finally {
      setSending(false);
    }
  }, [draft, sending, planId, toast]);

  if (planLoading && !detail) {
    return (
      <Screen scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen
        header={
          <ScreenPad><Row style={{ paddingVertical: spacing.sm }}><Button variant="back" onPress={() => navigation.goBack()} /></Row></ScreenPad>
        }
        scroll={false}
      >
        <EmptyState emoji="💬" title="Chat unavailable" sub={error ? 'Check your connection and try again.' : 'This plan is no longer available.'} />
      </Screen>
    );
  }

  const plan = detail.plan;
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
  const peopleCount = Math.max(0, plan.capacity - plan.spotsRemaining);

  const header = (
    <ScreenPad style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row gap="sm" style={{ paddingVertical: spacing.md - 2 }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Stack style={{ width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
          <Icon name={cat.icon as never} size={18} color={cat.iconColor} strokeWidth={2} />
        </Stack>
        <Stack style={{ flex: 1, minWidth: 0 }}>
          <T.LabelMd numberOfLines={1}>{plan.activity}</T.LabelMd>
          <T.MetaXs numberOfLines={1}>{plan.location.split(',')[0]} · {peopleCount} people</T.MetaXs>
        </Stack>
        <Pressable onPress={() => navigation.navigate('Plan', { planId: plan.id })} hitSlop={spacing.sm}>
          <Icon name="info" size={iconSizes.md} color={colors.textDim} />
        </Pressable>
      </Row>
    </ScreenPad>
  );

  const planStrip = (
    <Row gap="sm" style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
      <Countdown startsAt={plan.startsAt} />
      <T.MetaXs color={colors.textGhost}>·</T.MetaXs>
      <T.Meta numberOfLines={1} style={{ flex: 1 }}>{plan.location.split(',')[0]}</T.Meta>
      <T.MetaXs color={colors.textGhost}>·</T.MetaXs>
      <CostTag type={plan.cost} note={plan.costNote} />
    </Row>
  );

  const footer = (
    <Row gap="sm" style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, paddingBottom: spacing.lg + 4, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      <Row style={{ flex: 1, borderWidth: borderWidths.medium, borderRadius: radii.xxl, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, borderColor: colors.border, backgroundColor: colors.surface }}>
        <RNTextInput
          style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 14, color: colors.text, padding: 0 }}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the group…"
          placeholderTextColor={colors.textDim}
          onSubmitEditing={send}
          returnKeyType="send"
        />
      </Row>
      <Pressable onPress={send} disabled={sending} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg }}>
        <Icon name="send" size={iconSizes.sm} color={colors.ctaFg} />
      </Pressable>
    </Row>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      {planStrip}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.screenPx, gap: 6 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          loadingMsgs ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <T.BodyMd color={colors.textSub}>No messages yet — say hi 👋</T.BodyMd>
            </View>
          )
        }
        renderItem={({ item }) => {
          const mine = item.authorId === myUid;
          return (
            <Row gap="sm" align="flex-end" style={{ flexDirection: mine ? 'row-reverse' : 'row', marginBottom: spacing.sm }}>
              {!mine ? <Avatar uri={item.authorAvatarUri} name={item.authorName} size={28} shape="circle" /> : null}
              <Stack>
                {!mine ? <T.LabelXs color={colors.textSub} style={{ marginBottom: 3, paddingLeft: 2 }}>{item.authorName}{item.isHost ? ' · Host' : ''}</T.LabelXs> : null}
                <View style={{ maxWidth: 280, paddingHorizontal: 13, paddingVertical: spacing.sm + 2, borderRadius: 16, ...(mine ? { borderTopRightRadius: 4, backgroundColor: colors.coral } : { borderTopLeftRadius: 4, backgroundColor: colors.surfaceMid }) }}>
                  <T.BodyMd color={mine ? colors.white : colors.text}>{item.body}</T.BodyMd>
                </View>
              </Stack>
            </Row>
          );
        }}
      />
    </Screen>
  );
}
