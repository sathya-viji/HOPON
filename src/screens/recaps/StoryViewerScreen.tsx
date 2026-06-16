import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { fontFamilies, spacing, radii } from '@/theme/tokens';
import { timeAgo } from '@/utils/time';
import { getStoriesFeed, recordStoryView, deleteStory } from '@/api/stories';
import { submitReport, type ReportReasonValue } from '@/api/safety';
import { supabase } from '@/api/client';
import { useToast } from '@/hooks/useToast';
import type { StoryGroup } from '@/types';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'StoryViewer'>;

const STORY_DURATION = 5000;
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

const REPORT_REASONS: { label: string; value: ReportReasonValue }[] = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Inappropriate content', value: 'inappropriate_content' },
  { label: 'Other', value: 'other' },
];

export function StoryViewerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Load the full feed and start on the author-group + story we were opened on.
  // Keeping every group (not just the opened one) lets playback flow continuously
  // into the next author's stories, Instagram-style.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const feed = await getStoriesFeed();
        if (cancelled) return;
        setMyUid(session?.user?.id ?? null);
        const gIdx = feed.findIndex((g) => g.stories.some((s) => s.id === route.params.storyId));
        if (gIdx < 0) { navigation.goBack(); return; }
        const sIdx = Math.max(0, feed[gIdx].stories.findIndex((s) => s.id === route.params.storyId));
        setGroups(feed);
        setGroupIdx(gIdx);
        setCurrentIdx(sIdx);
      } catch {
        if (!cancelled) navigation.goBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [route.params.storyId, navigation]);

  const group = groups[groupIdx];
  const stories = group?.stories ?? [];
  const author = group?.author ?? null;
  const story = stories[currentIdx];
  const isMine = !!(myUid && author && author.id === myUid);

  // Advance within the current author's stories, crossing into the next/previous
  // author group at the edges. Closes the viewer past the very last story or
  // before the very first.
  const advance = (dir: 1 | -1) => {
    const within = currentIdx + dir;
    if (within >= 0 && within < stories.length) {
      progress.setValue(0);
      setCurrentIdx(within);
      return;
    }
    if (dir === 1) {
      if (groupIdx + 1 < groups.length) {
        progress.setValue(0);
        setGroupIdx(groupIdx + 1);
        setCurrentIdx(0);
      } else {
        navigation.goBack();
      }
    } else if (groupIdx - 1 >= 0) {
      progress.setValue(0);
      const prev = groups[groupIdx - 1].stories;
      setGroupIdx(groupIdx - 1);
      setCurrentIdx(Math.max(0, prev.length - 1));
    } else {
      navigation.goBack();
    }
  };

  // Record a view each time a story is shown (idempotent server-side).
  useEffect(() => {
    if (story) recordStoryView(story.id).catch(() => { /* best-effort */ });
  }, [story?.id]);

  useEffect(() => {
    if (!story) return;
    progress.setValue(0);
    if (paused) return;
    animRef.current = Animated.timing(progress, { toValue: 1, duration: STORY_DURATION, useNativeDriver: false });
    animRef.current.start(({ finished }) => { if (finished) advance(1); });
    return () => { animRef.current?.stop(); };
  }, [currentIdx, paused, story?.id]);

  const handleTapLeft = () => { animRef.current?.stop(); advance(-1); };
  const handleTapRight = () => { animRef.current?.stop(); advance(1); };

  const onReport = () => {
    if (!story) return;
    setPaused(true);
    Alert.alert('Report this story', 'Why are you reporting it?', [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: async () => {
          try { await submitReport('story', story.id, r.value); toast.show('Thanks — our team will review this.'); }
          catch { toast.show('Couldn’t submit report.'); }
          finally { setPaused(false); }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const, onPress: () => setPaused(false) },
    ]);
  };

  const onDelete = () => {
    if (!story) return;
    setPaused(true);
    Alert.alert('Delete story?', 'This removes it for everyone.', [
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteStory(story.id); toast.show('Story deleted'); navigation.goBack(); }
        catch { toast.show('Couldn’t delete story.'); setPaused(false); }
      } },
      { text: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
    ]);
  };

  if (loading || !story || !author) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      <Image source={{ uri: story.imageUri }} style={StyleSheet_absoluteFill} contentFit="cover" />

      <LinearGradient colors={['rgba(0,0,0,0.72)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 }} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 2 }} pointerEvents="none" />

      {/* Progress bars (one per story in this author's group) */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 10 }}>
        {stories.map((s, i) => (
          <View key={s.id} style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}>
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: '#fff',
                borderRadius: 2,
                width: i < currentIdx ? '100%' : i === currentIdx ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%',
              }}
            />
          </View>
        ))}
      </View>

      {/* Author row + close */}
      <View style={{ position: 'absolute', top: insets.top + 20, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', overflow: 'hidden' }}>
            <Avatar uri={author.avatarUri} name={author.name} size={36} shape="circle" />
          </View>
          <View>
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14, color: '#fff' }}>{author.name}</Text>
            <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{timeAgo(story.createdAt)}</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={18} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Tap zones */}
      <View style={[StyleSheet_absoluteFill, { flexDirection: 'row', zIndex: 5 }]} pointerEvents="box-none">
        <Pressable style={{ flex: 1 }} onPress={handleTapLeft} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        <Pressable style={{ flex: 1 }} onPress={handleTapRight} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
      </View>

      {/* Bottom-left: plan pill + caption */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 80, paddingHorizontal: spacing.screenPx, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) + 16, zIndex: 20 }}>
        {story.planLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.full, paddingVertical: 5, paddingHorizontal: 12, marginBottom: 10 }}>
            <Icon name="map-pin" size={10} color="#fff" />
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>{story.planLabel}</Text>
          </View>
        ) : null}
        {story.caption ? (
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 15, color: '#fff', lineHeight: 23, marginBottom: 16 }} numberOfLines={3}>{story.caption}</Text>
        ) : null}
      </View>

      {/* Bottom-right actions: report (others) or delete (own), + share */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 72, alignItems: 'center', flexDirection: 'column', gap: 22, paddingRight: 12, paddingBottom: Math.max(insets.bottom, 16) + 16, zIndex: 20 }}>
        {isMine ? (
          <Pressable onPress={onDelete} hitSlop={spacing.sm} style={{ alignItems: 'center', gap: 4 }}>
            <Icon name="trash-2" size={28} color="#fff" strokeWidth={1.75} />
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>Delete</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onReport} hitSlop={spacing.sm} style={{ alignItems: 'center', gap: 4 }}>
            <Icon name="flag" size={28} color="#fff" strokeWidth={1.75} />
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>Report</Text>
          </Pressable>
        )}
        <Pressable onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} onPress={() => toast.show('Share')} hitSlop={spacing.sm} style={{ alignItems: 'center', gap: 4 }}>
          <Icon name="share-2" size={28} color="#fff" strokeWidth={1.75} />
          <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}
