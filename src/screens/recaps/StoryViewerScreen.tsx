import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { fontFamilies, spacing, radii } from '@/theme/tokens';
import { stories, getUserById } from '@/mocks';
import { timeAgo } from '@/utils/time';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'StoryViewer'>;

const STORY_DURATION = 5000;

// absoluteFill is a structural layout constant — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function StoryViewerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const startIdx = stories.findIndex((s) => s.id === route.params.storyId);
  const [currentIdx, setCurrentIdx] = useState(startIdx < 0 ? 0 : startIdx);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([
    { id: 'c1', name: 'Arjun M', text: 'Looks amazing! 🔥', time: '2m ago' },
    { id: 'c2', name: 'Priya S', text: 'Love this spot', time: '5m ago' },
    { id: 'c3', name: 'Kiran B', text: 'Been meaning to go here!', time: '11m ago' },
  ]);

  const story = stories[currentIdx];
  const author = getUserById(story.authorId);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const goToStory = (idx: number) => {
    if (idx < 0 || idx >= stories.length) {
      navigation.goBack();
      return;
    }
    progress.setValue(0);
    setCurrentIdx(idx);
  };

  useEffect(() => {
    progress.setValue(0);
    if (paused) return;
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goToStory(currentIdx + 1);
    });
    return () => { animRef.current?.stop(); };
  }, [currentIdx, paused]);

  const handleTapLeft = () => { animRef.current?.stop(); goToStory(currentIdx - 1); };
  const handleTapRight = () => { animRef.current?.stop(); goToStory(currentIdx + 1); };
  const isLiked = liked.has(story.id);

  const submitComment = () => {
    if (!commentText.trim()) return;
    setComments((prev) => [{ id: Date.now().toString(), name: 'You', text: commentText.trim(), time: 'just now' }, ...prev]);
    setCommentText('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Full-bleed photo */}
      <Image source={{ uri: story.imageUri }} style={StyleSheet_absoluteFill} contentFit="cover" />

      {/* Gradients — intentional media chrome rgba values */}
      <LinearGradient colors={['rgba(0,0,0,0.72)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 }} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 2 }} pointerEvents="none" />

      {/* Progress bars */}
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
            <Avatar uri={author?.avatarUri} name={author?.name} size={36} shape="circle" />
          </View>
          <View>
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14, color: '#fff' }}>{author?.name}</Text>
            <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{timeAgo(story.createdAt)}</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* Bottom-right actions */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 72, alignItems: 'center', flexDirection: 'column', gap: 20, paddingRight: 12, paddingBottom: Math.max(insets.bottom, 16) + 16, zIndex: 20 }}>
        <Pressable
          onPress={() => setLiked((prev) => { const next = new Set(prev); if (next.has(story.id)) next.delete(story.id); else next.add(story.id); return next; })}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          hitSlop={10}
          style={{ alignItems: 'center', gap: 4 }}
        >
          <Icon name="heart" size={30} color={isLiked ? '#FF375F' : '#fff'} strokeWidth={isLiked ? 2.5 : 1.75} />
          <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>{isLiked ? 15 : 14}</Text>
        </Pressable>
        <Pressable onPress={() => { setPaused(true); setCommentOpen(true); }} hitSlop={10} style={{ alignItems: 'center', gap: 4 }}>
          <Icon name="message-circle" size={30} color="#fff" strokeWidth={1.75} />
          <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>{comments.length}</Text>
        </Pressable>
        <Pressable onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} hitSlop={10} style={{ alignItems: 'center', gap: 4 }}>
          <Icon name="share-2" size={30} color="#fff" strokeWidth={1.75} />
          <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 12, color: '#fff' }}>Share</Text>
        </Pressable>
      </View>

      {/* Comment sheet */}
      <Modal visible={commentOpen} transparent animationType="slide" onRequestClose={() => { setCommentOpen(false); setPaused(false); }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => { setCommentOpen(false); setPaused(false); }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.screenPx, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 14 }} />
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 16, color: '#0A0A0A', marginBottom: 14 }}>Comments</Text>
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {comments.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fontFamilies.bold, fontSize: 13, color: '#555' }}>{c.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fontFamilies.bold, fontSize: 13, color: '#0A0A0A' }}>{c.name} <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, color: '#999' }}>{c.time}</Text></Text>
                    <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, color: '#333', marginTop: 2 }}>{c.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10, marginTop: 4 }}>
              <TextInput
                placeholder="Add a comment…"
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 14, color: '#0A0A0A', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F5F5F5', borderRadius: 20 }}
                returnKeyType="send"
                onSubmitEditing={submitComment}
              />
              <Pressable onPress={submitComment} hitSlop={8}>
                <Icon name="send" size={20} color={commentText.trim() ? '#FF4D2E' : '#ccc'} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
