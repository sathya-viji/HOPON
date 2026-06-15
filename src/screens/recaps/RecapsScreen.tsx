import React, { useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Icon } from '@/components/atoms/Icon';
import { EmptyState } from '@/components/atoms/EmptyState';
import { StoryBubble } from '@/components/molecules/StoryBubble';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { RecapCard } from '@/components/molecules/RecapCard';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes } from '@/theme/tokens';
import { useFocusResource } from '@/api/hooks/useFocusResource';
import { getRecapsFeed } from '@/api/recaps';
import { getStoriesFeed } from '@/api/stories';
import { getFamiliarFaces } from '@/api/trust';
import { getMyProfile } from '@/api/users';
import { supabase } from '@/api/client';
import { errorMessage } from '@/api/errors';
import type { Recap, StoryGroup } from '@/types';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'Recaps'>;

const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

interface FeedData {
  recaps: Recap[];
  groups: StoryGroup[];
  familiarIds: string[];
  myUid: string | null;
  myAvatarUri?: string;
}

async function loadFeed(): Promise<FeedData> {
  const { data: { session } } = await supabase.auth.getSession();
  const myUid = session?.user?.id ?? null;
  const [recaps, groups, familiar, me] = await Promise.all([
    getRecapsFeed(),
    getStoriesFeed(),
    getFamiliarFaces().catch(() => []),
    getMyProfile().catch(() => null),
  ]);
  return {
    recaps,
    groups,
    familiarIds: familiar.map((f) => f.user.id),
    myUid,
    myAvatarUri: me?.avatarUri,
  };
}

export function RecapsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { data, loading, refreshing, error, refetch } = useFocusResource(loadFeed);

  const header = (
    <ScreenPad style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
        <T.PageTitle>Recaps</T.PageTitle>
        <Spacer flex />
        <Pressable
          onPress={() => navigation.navigate('RecapPost', {})}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: spacing.md - 2, borderRadius: radii.sm, backgroundColor: colors.ctaBg }}
          accessibilityRole="button"
          accessibilityLabel="Post a recap"
        >
          <Icon name="image-plus" size={iconSizes.xs} color={colors.ctaFg} />
          <T.LabelXs color={colors.ctaFg}>Post</T.LabelXs>
        </Pressable>
      </Row>
    </ScreenPad>
  );

  const openStoryGroup = useCallback(
    (group: StoryGroup) => {
      if (group.stories.length === 0) return;
      navigation.navigate('StoryViewer', { storyId: group.stories[0].id });
    },
    [navigation],
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

  if (error && !data) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="⚠️" title="Couldn’t load recaps" sub={errorMessage(error, 'Check your connection and try again.')} cta="Retry" onCtaPress={refetch} />
      </Screen>
    );
  }

  const recaps = data?.recaps ?? [];
  const groups = data?.groups ?? [];
  const familiarSet = new Set(data?.familiarIds ?? []);
  const myUid = data?.myUid ?? null;

  const myGroup = myUid ? groups.find((g) => g.author.id === myUid) ?? null : null;
  const otherGroups = groups.filter((g) => g.author.id !== myUid);
  const myStoryUri = myGroup?.stories[0]?.imageUri ?? data?.myAvatarUri;

  const familiar = recaps.filter((r) => familiarSet.has(r.authorId));
  const nearBy = recaps.filter((r) => !familiarSet.has(r.authorId));

  return (
    <Screen header={header} scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.coral} />}
      >
        {/* Stories row */}
        <Stack style={{ paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
          <T.CapsSm style={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.sm }}>Just happened</T.CapsSm>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPx, gap: spacing.md }}>
            {/* Your story bubble */}
            <Stack style={{ alignItems: 'center', gap: 5, width: 64, flexShrink: 0, position: 'relative' }}>
              <Pressable
                onPress={() => (myGroup ? openStoryGroup(myGroup) : navigation.navigate('CreateStory'))}
                accessibilityRole="button"
                accessibilityLabel={myGroup ? 'View your story' : 'Add your story'}
              >
                <View style={{ width: 58, height: 58, borderRadius: 29, padding: 2.5, backgroundColor: myGroup ? colors.coral : colors.borderMid }}>
                  <View style={{ flex: 1, borderRadius: 29, overflow: 'hidden', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', borderColor: colors.bg, backgroundColor: colors.surface }}>
                    {myStoryUri ? (
                      <Image source={{ uri: myStoryUri }} style={[StyleSheet_absoluteFill, !myGroup && { opacity: 0.5 }]} contentFit="cover" />
                    ) : null}
                    {!myGroup ? (
                      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral, borderColor: colors.bg }}>
                        <Icon name="plus" size={10} color={colors.white} strokeWidth={2.5} />
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              {myGroup ? (
                <Pressable
                  onPress={() => navigation.navigate('CreateStory')}
                  style={{ position: 'absolute', bottom: 18, right: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2, backgroundColor: colors.coral, borderColor: colors.bg }}
                  hitSlop={4}
                >
                  <Icon name="plus" size={10} color={colors.white} strokeWidth={2.5} />
                </Pressable>
              ) : null}
              <T.MetaXs style={{ textAlign: 'center' }}>{myGroup ? 'Your story' : 'Add story'}</T.MetaXs>
            </Stack>

            {otherGroups.map((g) => (
              <StoryBubble
                key={g.author.id}
                imageUri={g.stories[0]?.imageUri ?? ''}
                name={g.author.name.split(' ')[0]}
                seen={g.allSeen}
                onPress={() => openStoryGroup(g)}
              />
            ))}
          </ScrollView>
        </Stack>

        {familiar.length > 0 ? (
          <>
            <SectionHeader label="FAMILIAR FACES" count={familiar.length} />
            {familiar.map((r) => <RecapCard key={r.id} recap={r} onPress={() => navigation.navigate('RecapDetail', { recapId: r.id })} />)}
          </>
        ) : null}

        {nearBy.length > 0 ? (
          <>
            <SectionHeader label="NEAR YOU" count={nearBy.length} />
            {nearBy.map((r) => <RecapCard key={r.id} recap={r} onPress={() => navigation.navigate('RecapDetail', { recapId: r.id })} />)}
          </>
        ) : null}

        {recaps.length === 0 ? (
          <EmptyState emoji="📸" title="No recaps yet" sub="Be the first to share a moment from a plan." cta="Post a recap" onCtaPress={() => navigation.navigate('RecapPost', {})} />
        ) : null}
        <Spacer size="lg" />
      </ScrollView>
    </Screen>
  );
}
