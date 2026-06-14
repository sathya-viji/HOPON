import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';

interface BadgeProps {
  label: string;
  bg?: string;
  fg?: string;
}

export function Badge({ label, bg, fg }: BadgeProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? colors.surfaceMid }]}>
      <Text style={[styles.text, { color: fg ?? colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
  },
});
