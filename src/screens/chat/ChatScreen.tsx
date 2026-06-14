import React, { useState } from 'react';
import { View, FlatList, TextInput as RNTextInput } from 'react-native';
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
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, fontFamilies, CATEGORIES } from '@/theme/tokens';
import { plans, getPlanById, getUserById, CURRENT_USER_ID } from '@/mocks';
import type { HomeStackParamList } from '@/navigation/types';
import { Message } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'Chat'>;

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function ChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const plan = getPlanById(route.params?.planId) ?? plans[1];
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId)!;

  const seed: Message[] = plan.joinerIds.slice(0, 3).map((id, i) => {
    const u = getUserById(id)!;
    return {
      id: `m${i}`,
      planId: plan.id,
      authorId: u.id,
      authorName: u.name,
      authorAvatarUri: u.avatarUri,
      isHost: false,
      body: ['On my way!', 'Same — see you there.', 'Wear something warm.'][i] ?? 'Hi',
      createdAt: minsAgo(30 - i * 5),
    };
  });

  const [messages, setMessages] = useState<Message[]>(seed);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { id: `m-${Date.now()}`, planId: plan.id, authorId: CURRENT_USER_ID, authorName: 'You', isHost: plan.hostId === CURRENT_USER_ID, body: draft.trim(), createdAt: new Date().toISOString() }]);
    setDraft('');
  };

  const header = (
    <ScreenPad style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row gap="sm" style={{ paddingVertical: spacing.md - 2 }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <Stack style={{ width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
          <Icon name={cat.icon as never} size={18} color={cat.iconColor} strokeWidth={2} />
        </Stack>
        <Stack style={{ flex: 1, minWidth: 0 }}>
          <T.LabelMd numberOfLines={1}>{plan.activity}</T.LabelMd>
          <T.MetaXs numberOfLines={1}>{plan.location.split(',')[0]} · {plan.capacity - plan.spotsRemaining} people</T.MetaXs>
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
        />
      </Row>
      <Pressable onPress={send} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg }}>
        <Icon name="send" size={iconSizes.sm} color={colors.ctaFg} />
      </Pressable>
    </Row>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      {planStrip}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.screenPx, gap: 6 }}
        renderItem={({ item }) => {
          const mine = item.authorId === CURRENT_USER_ID;
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
