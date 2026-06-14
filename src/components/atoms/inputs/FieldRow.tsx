import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies, letterSpacing } from '@/theme/tokens';
import { Icon, IconName } from '../Icon';

interface FieldRowProps {
  icon?: IconName;
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  selected?: boolean;
}

export function FieldRow({ icon, label, value, placeholder, onPress, selected }: FieldRowProps) {
  const { colors } = useTheme();
  const filled = !!value || selected;
  const borderColor = filled ? colors.black : colors.border;
  const bg = filled ? colors.surfaceMid : colors.surface;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: bg, borderColor }]}
      android_ripple={{ color: colors.surfaceMid }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Icon name={icon} size={20} color={colors.textSub} /> : null}
      <View style={styles.col}>
        <Text style={[styles.label, { color: colors.textSub }]}>{label}</Text>
        <Text
          style={[
            styles.value,
            { color: value ? colors.text : colors.textDim },
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder ?? ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    minHeight: 56,
  },
  col: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    letterSpacing: letterSpacing.tags * 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
});
