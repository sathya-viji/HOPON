import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { User } from '@/types';

interface HostCardProps {
  host: User;
  onPress?: () => void;
}

export function HostCard({ host, onPress }: HostCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      android_ripple={{ color: colors.surfaceMid }}
      accessibilityRole="button"
      accessibilityLabel={`Host: ${host.name}`}
    >
      <Avatar uri={host.avatarUri} name={host.name} size={48} shape="rounded" />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {host.name}
          </Text>
          {host.isVerified ? (
            <Icon name="badge-check" size={14} color={colors.green} strokeWidth={2.5} />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.green }]}>
            {host.attendanceScore !== null ? `${host.attendanceScore}% attendance` : 'New'}
          </Text>
          <Text style={[styles.dot, { color: colors.textGhost }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.textSub }]}>
            {host.plansHosted} hosted
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenPx,
    marginVertical: spacing.lg,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: fontFamilies.bold, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontFamily: fontFamilies.semibold, fontSize: 11 },
  dot: { fontSize: 10 },
});
