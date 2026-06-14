import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, letterSpacing, radii } from '@/theme/tokens';
import { Icon, IconName } from '@/components/atoms/Icon';

export interface FilterPill {
  id: string;
  label: string;
  icon?: IconName;
  active?: boolean;
  isNow?: boolean;
  disabled?: boolean;
}

interface FilterPillsProps {
  pills: FilterPill[];
  onSelect: (id: string) => void;
}

export function FilterPills({ pills, onSelect }: FilterPillsProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {pills.map((pill) => {
        if (pill.disabled) {
          return <View key={pill.id} style={[styles.sep, { backgroundColor: colors.border }]} />;
        }
        const bg = pill.active
          ? pill.isNow
            ? colors.coral
            : colors.text
          : colors.bg;
        const fg = pill.active ? colors.bg : colors.textSub;
        const borderColor = pill.active
          ? pill.isNow
            ? colors.coral
            : colors.text
          : colors.border;
        return (
          <Pressable
            key={pill.id}
            onPress={() => onSelect(pill.id)}
            style={[styles.pill, { backgroundColor: bg, borderColor }]}
            accessibilityRole="button"
            accessibilityState={{ selected: !!pill.active }}
            accessibilityLabel={pill.label}
          >
            {pill.icon ? <Icon name={pill.icon} size={11} color={fg} /> : null}
            <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
              {pill.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.screenPx, gap: 6, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.xs,
    borderWidth: 1,
  },
  text: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    letterSpacing: letterSpacing.meta * 11,
  },
  sep: { width: 1, height: 16, marginHorizontal: 2 },
});
