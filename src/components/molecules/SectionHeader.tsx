import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, letterSpacing } from '@/theme/tokens';

interface SectionHeaderProps {
  label: string;
  count?: number;
  action?: string;
  onActionPress?: () => void;
  showCoralDot?: boolean;
}

export function SectionHeader({ label, count, action, onActionPress, showCoralDot }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        {showCoralDot ? (
          <View style={[styles.dot, { backgroundColor: colors.coral }]} />
        ) : null}
        <Text style={[styles.label, { color: colors.textSub }]}>
          {label}
          {count !== undefined ? ` · ${count}` : ''}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={onActionPress} hitSlop={spacing.sm} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[styles.action, { color: colors.coral }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPx,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 10,
    letterSpacing: letterSpacing.sectionHeader * 10,
    textTransform: 'uppercase',
  },
  action: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});
