import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';
import { getInitials } from '@/utils/avatar';

interface AvatarProps {
  uri?: string;
  initials?: string;
  name?: string;
  size: 18 | 22 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 72 | 80;
  shape?: 'circle' | 'rounded';
  border?: boolean;
  borderRadius?: number;
}

export function Avatar({ uri, initials, name, size, shape = 'circle', border, borderRadius: borderRadiusOverride }: AvatarProps) {
  const { colors } = useTheme();
  const [errored, setErrored] = useState(false);

  const computedInitials = initials ?? (name ? getInitials(name) : '');
  const radius = borderRadiusOverride ?? (shape === 'circle' ? size / 2 : radii.lg);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden' as const,
    backgroundColor: colors.surfaceMid,
    ...(border
      ? { borderWidth: 2, borderColor: colors.bg }
      : { borderWidth: 1, borderColor: colors.border }),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (!uri || errored) {
    return (
      <View style={baseStyle}>
        <Text
          style={{
            color: colors.textSub,
            fontFamily: fontFamilies.bold,
            fontSize: Math.round(size * 0.38),
          }}
        >
          {computedInitials}
        </Text>
      </View>
    );
  }

  return (
    <View style={baseStyle}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        onError={() => setErrored(true)}
      />
    </View>
  );
}
