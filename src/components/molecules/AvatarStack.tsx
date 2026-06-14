import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/tokens';

interface AvatarStackProps {
  uris: string[];
  max?: number;
  size?: number;
  overlap?: number;
  borderColor?: string;
}

export function AvatarStack({ uris, max = 5, size = 28, overlap = 8, borderColor }: AvatarStackProps) {
  const { colors } = useTheme();
  const visible = uris.slice(0, max);
  const extra = uris.length - visible.length;
  const border = borderColor ?? colors.bg;

  return (
    <View style={styles.row}>
      {visible.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          style={[
            styles.av,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: border,
              backgroundColor: colors.surfaceMid,
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: visible.length - i,
            },
          ]}
        >
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.av,
            styles.extra,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: border,
              backgroundColor: colors.surfaceMid,
              marginLeft: -overlap,
            },
          ]}
        >
          <Text style={[styles.extraText, { color: colors.textSub, fontSize: Math.round(size * 0.36) }]}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  av: { borderWidth: 2, overflow: 'hidden' },
  extra: { alignItems: 'center', justifyContent: 'center' },
  extraText: { fontFamily: fontFamilies.bold },
});
