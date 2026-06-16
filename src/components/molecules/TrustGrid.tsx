import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii, letterSpacing } from '@/theme/tokens';

interface TrustGridProps {
  hosted: number;
  joined: number;
  attendance: number | null;
  met: number;
}

export function TrustGrid({ hosted, joined, attendance, met }: TrustGridProps) {
  const { colors } = useTheme();
  const stats = [
    { num: hosted, label: 'HOSTED' },
    { num: joined, label: 'ATTENDED' },
    { num: attendance === null ? '—' : `${attendance}%`, label: 'ATTENDANCE', hi: attendance !== null && attendance >= 85 },
    { num: met, label: 'MET' },
  ];
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View key={s.label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.num, { color: s.hi ? colors.green : colors.text }]}>{s.num}</Text>
          <Text
            style={[styles.label, { color: colors.textSub }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: spacing.screenPx,
    marginVertical: 14,
  },
  stat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  num: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 20,
    letterSpacing: -0.03 * 20,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    letterSpacing: 0.06 * 9,
    marginTop: 3,
  },
});
