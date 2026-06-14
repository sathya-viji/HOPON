import React from 'react';
import { Text, Pressable, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { radii, spacing } from '@/theme/tokens';

interface DestructiveButtonProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function DestructiveButton({ label, onPress, style }: DestructiveButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          width: '100%',
          paddingVertical: spacing.lg,
          borderRadius: radii.xl,
          alignItems: 'center',
          backgroundColor: colors.cost.sponsoredFg,
        },
        style,
      ]}
    >
      <Text style={[textStyles.labelLg, { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}
