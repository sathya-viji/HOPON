import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
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
import { recaps, stories as storyList, getUserById, CURRENT_USER_ID } from '@/mocks';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'Recaps'>;

// absoluteFill for image cover — structural layout constant
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function RecapsScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const me = getUserById(CURRENT_USER_ID)!;
  const familiar = recaps.filter((r) => me.familiarFaceIds.includes(r.authorId));
  const nearBy = recaps.filter((r) => !me.familiarFaceIds.includes(r.authorId));
  const myStory = storyList.find((s) => s.authorId === CURRENT_USER_ID) ?? null;
  const otherStories = storyList.filter((s) => s.authorId !== CURRENT_USER_ID);

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

  return (
    <Screen header={header} scroll={false}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Stories row */}
        <Stack style={{ paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
          <T.CapsSm style={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.sm }}>Just happened</T.CapsSm>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screenPx, gap: spacing.md }}>
            {/* Your story bubble */}
            <Stack style={{ alignItems: 'center', gap: 5, width: 64, flexShrink: 0, position: 'relative' }}>
              <Pressable
                onPress={() => myStory ? navigation.navigate('StoryViewer', { storyId: myStory.id }) : navigation.navigate('CreateStory')}
                accessibilityRole="button"
                accessibilityLabel={myStory ? 'View your story' : 'Add your story'}
              >
                <View style={{ width: 58, height: 58, borderRadius: 29, padding: 2.5, backgroundColor: myStory ? colors.coral : colors.borderMid }}>
                  <View style={{ flex: 1, borderRadius: 29, overflow: 'hidden', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', borderColor: colors.bg, backgroundColor: colors.surface }}>
                    {(myStory?.imageUri ?? me.avatarUri) ? (
                      <Image source={{ uri: myStory?.imageUri ?? me.avatarUri }} style={[StyleSheet_absoluteFill, !myStory && { opacity: 0.5 }]} contentFit="cover" />
                    ) : null}
                    {!myStory ? (
                      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral, borderColor: colors.bg }}>
                        <Icon name="plus" size={10} color={colors.white} strokeWidth={2.5} />
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              {myStory ? (
                <Pressable
                  onPress={() => navigation.navigate('CreateStory')}
                  style={{ position: 'absolute', bottom: 18, right: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2, backgroundColor: colors.coral, borderColor: colors.bg }}
                  hitSlop={4}
                >
                  <Icon name="plus" size={10} color={colors.white} strokeWidth={2.5} />
                </Pressable>
              ) : null}
              <T.MetaXs style={{ textAlign: 'center' }}>{myStory ? 'Your story' : 'Add story'}</T.MetaXs>
            </Stack>

            {otherStories.map((s) => {
              const author = getUserById(s.authorId);
              return (
                <StoryBubble key={s.id} imageUri={s.imageUri} name={author?.name.split(' ')[0] ?? 'User'} seen={s.isSeen} onPress={() => navigation.navigate('StoryViewer', { storyId: s.id })} />
              );
            })}
          </ScrollView>
        </Stack>

        {familiar.length > 0 ? (
          <>
            <SectionHeader label="FAMILIAR FACES" count={familiar.length} action="See all" />
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
