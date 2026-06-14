import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';

interface EndorsementTagProps {
  label: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}

export function EndorsementTag({ label, count, active, onPress }: EndorsementTagProps) {
  const { colors } = useTheme();
  const bg = active ? colors.black : colors.surface;
  const fg = active ? colors.white : colors.textSub;
  const borderColor = active ? colors.black : colors.border;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tag, { backgroundColor: bg, borderColor }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
        {count !== undefined ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.full,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
});
