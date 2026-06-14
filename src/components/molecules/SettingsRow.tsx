import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { Icon, IconName } from '@/components/atoms/Icon';

interface SettingsRowProps {
  icon?: IconName;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  value?: string;
  destructive?: boolean;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

export function SettingsRow({
  icon,
  iconBg,
  iconColor,
  label,
  sub,
  value,
  destructive,
  onPress,
  trailing,
}: SettingsRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
      android_ripple={{ color: colors.surfaceMid }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: iconBg ?? (destructive ? colors.cost.sponsoredBg : colors.surface) }]}>
          <Icon name={icon} size={18} color={iconColor ?? (destructive ? colors.cost.sponsoredFg : colors.textSub)} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.label,
            { color: destructive ? colors.cost.sponsoredFg : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: colors.textSub }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: colors.textSub }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing ?? (onPress ? <Icon name="chevron-right" size={16} color={colors.textDim} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.screenPx,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fontFamilies.semibold, fontSize: 15 },
  sub: { fontFamily: fontFamilies.regular, fontSize: 12, marginTop: 2 },
  value: { fontFamily: fontFamilies.semibold, fontSize: 13 },
});
