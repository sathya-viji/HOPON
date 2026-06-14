import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/tokens';

interface StoryBubbleProps {
  imageUri: string;
  name: string;
  seen?: boolean;
  onPress?: () => void;
}

export function StoryBubble({ imageUri, name, seen, onPress }: StoryBubbleProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.wrap} accessibilityRole="button" accessibilityLabel={name}>
      <View style={[styles.ring, { backgroundColor: seen ? colors.borderMid : colors.coral }]}>
        <View style={[styles.inner, { borderColor: colors.bg }]}>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      </View>
      <Text style={[styles.name, { color: colors.textSub }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5, flexShrink: 0, width: 64 },
  ring: { width: 58, height: 58, borderRadius: 29, padding: 2.5 },
  inner: { flex: 1, borderRadius: 29, overflow: 'hidden', borderWidth: 2.5 },
  name: { fontFamily: fontFamilies.semibold, fontSize: 10, maxWidth: 64, textAlign: 'center' },
});
