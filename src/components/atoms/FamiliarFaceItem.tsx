import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Avatar } from './Avatar';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { avatarSizes, spacing, HIT_SLOP } from '@/theme/tokens';

interface FamiliarFaceItemProps {
  uri?: string;
  name: string;
  onPress?: () => void;
}

export function FamiliarFaceItem({ uri, name, onPress }: FamiliarFaceItemProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={HIT_SLOP.sm} style={{ alignItems: 'center', gap: spacing.xs + 1, width: 60 }}>
      <Avatar uri={uri} name={name} size={avatarSizes.lg} shape="circle" />
      <Text style={[textStyles.labelSm, { color: colors.text, textAlign: 'center' }]} numberOfLines={1}>
        {name.split(' ')[0]}
      </Text>
    </Pressable>
  );
}
