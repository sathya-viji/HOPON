import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { Icon } from '@/components/atoms/Icon';
import { AvatarStack } from './AvatarStack';

interface FamiliarFacesBannerProps {
  faces: { name: string; avatarUri: string }[];
}

export function FamiliarFacesBanner({ faces }: FamiliarFacesBannerProps) {
  const { colors } = useTheme();
  if (faces.length === 0) return null;

  const first = faces[0];
  const others = faces.length - 1;
  const label =
    others > 0
      ? `${first.name.split(' ')[0]} and ${others} other${others > 1 ? 's' : ''} you know are in`
      : `${first.name.split(' ')[0]} is joining this`;

  return (
    <View style={[styles.banner, { backgroundColor: colors.cost.freeBg }]}>
      <AvatarStack
        uris={faces.map((f) => f.avatarUri)}
        max={3}
        size={28}
        borderColor={colors.cost.freeBg}
      />
      <Text style={[styles.text, { color: colors.cost.freeFg }]} numberOfLines={2}>
        {label}
      </Text>
      <Icon name="users" size={14} color={colors.cost.freeFg} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
  },
});
