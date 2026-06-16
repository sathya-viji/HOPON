import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, letterSpacing } from '@/theme/tokens';
import { Plan } from '@/types';
import { ActivityIcon } from '@/components/atoms/ActivityIcon';
import { Countdown } from '@/components/atoms/Countdown';
import { CostTag } from '@/components/atoms/CostTag';
import { SpotsBadge } from '@/components/atoms/SpotsBadge';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { GenderBadge } from './GenderBadge';
import { planDateLabel, isToday } from '@/utils/time';

export type PlanRowVariant = 'nearby' | 'joined' | 'created' | 'history';

interface PlanRowProps {
  plan: Plan;
  variant: PlanRowVariant;
  onPress: (planId: string) => void;
  onJoin?: (planId: string) => void;
}

export const PLAN_ROW_HEIGHT = 72;

export function PlanRow({ plan, variant, onPress, onJoin }: PlanRowProps) {
  const { colors } = useTheme();
  const host = plan.host;
  const isJoined = variant === 'joined';
  const isMine = plan.isMine || variant === 'created';
  const isFull = plan.status === 'full' || plan.spotsRemaining <= 0;

  // Per prototype line 1082-1085: HOP ON / YOURS / FULL / IN (with check)
  const joinVariant: 'join' | 'join-joined' | 'join-mine' | 'join-full' = isMine
    ? 'join-mine'
    : isFull
      ? 'join-full'
      : isJoined
        ? 'join-joined'
        : 'join';
  const joinLabel = isMine ? 'YOURS' : isFull ? 'FULL' : isJoined ? 'IN' : 'HOP ON';

  const containerStyle = [
    styles.row,
    {
      borderBottomColor: colors.border,
      paddingLeft: isJoined ? spacing.screenPx - 3 : spacing.screenPx,
      backgroundColor: isJoined ? colors.joinedRowBg : colors.bg,
    },
    isJoined ? { borderLeftWidth: 3, borderLeftColor: colors.green } : null,
  ];

  const hostFirstName = host?.name.split(' ')[0] ?? '';
  const attendance = host?.attendanceScore ?? null;
  const whereShort = plan.location.split(',')[0];
  // Plans on a different calendar day: show date only, no countdown
  const isThisWeek = plan.minutesUntilStart > 240 && !isToday(plan.startsAt);
  const dateLabel = isThisWeek ? planDateLabel(plan.startsAt) : null;

  const btnPalette = isMine
    ? { bg: colors.joinBtnMineBg, fg: colors.joinBtnMineFg, borderColor: colors.joinBtnMineBorder, borderWidth: 1.5 }
    : isFull
      ? { bg: colors.surface, fg: colors.textSub, borderColor: colors.border, borderWidth: 1 }
      : isJoined
        ? { bg: colors.joinBtnJoinedBg, fg: colors.joinBtnJoinedFg, borderColor: colors.joinBtnJoinedBorder, borderWidth: 1.5 }
        : { bg: colors.ctaBg, fg: colors.ctaFg, borderColor: undefined, borderWidth: 0 };

  return (
    <Pressable
      onPress={() => onPress(plan.id)}
      style={containerStyle}
      android_ripple={{ color: colors.surfaceMid }}
      accessibilityRole="button"
      accessibilityLabel={`${plan.activity} at ${whereShort}`}
    >
      <ActivityIcon categoryId={plan.categoryId} size={40} />

      <View style={styles.info}>
        <Text style={[styles.what, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {plan.activity}
        </Text>
        <Text style={[styles.where, { color: colors.textSub }]} numberOfLines={1} ellipsizeMode="tail">
          {whereShort}
        </Text>
        <View style={styles.metaRow}>
          {isThisWeek ? (
            <Text style={[styles.dateLabel, { color: colors.textSub }]}>{dateLabel}</Text>
          ) : (
            <Countdown startsAt={plan.startsAt} status={plan.status} />
          )}
          <Text style={[styles.dot, { color: colors.textGhost }]}>·</Text>
          <SpotsBadge remaining={plan.spotsRemaining} />
          {plan.cost !== 'free' ? (
            <>
              <Text style={[styles.dot, { color: colors.textGhost }]}>·</Text>
              <CostTag type={plan.cost} note={plan.costNote} />
            </>
          ) : null}
          {plan.type === 'closed' ? (
            <>
              <Text style={[styles.dot, { color: colors.textGhost }]}>·</Text>
              <View style={styles.closedWrap}>
                <Icon name="lock" size={9} color={colors.textDim} />
                <Text style={[styles.closedText, { color: colors.textDim }]}>CLOSED</Text>
              </View>
            </>
          ) : null}
          <GenderBadge pref={plan.genderPref} />
        </View>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={() => {
            if (joinVariant === 'join') onJoin?.(plan.id);
            else onPress(plan.id);
          }}
          disabled={isFull && !isMine}
          style={[styles.joinBtn, { backgroundColor: btnPalette.bg, borderColor: btnPalette.borderColor, borderWidth: btnPalette.borderWidth }]}
          accessibilityRole="button"
          accessibilityLabel={`${joinLabel} ${plan.activity}`}
        >
          {isJoined && !isMine && !isFull ? (
            <Icon name="check" size={11} color={btnPalette.fg} strokeWidth={2.5} />
          ) : null}
          <Text style={[styles.joinLabel, { color: btnPalette.fg }]}>{joinLabel}</Text>
        </Pressable>

        {host ? (
          <View style={styles.hostRow}>
            <Avatar uri={host.avatarUri} name={host.name} size={18} shape="circle" />
            <Text style={[styles.hostName, { color: colors.text }]} numberOfLines={1}>
              {hostFirstName}
            </Text>
            {attendance !== null ? (
              <Text style={[styles.hostAtt, { color: colors.green }]}>{attendance}%</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: PLAN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: spacing.screenPx,
    borderBottomWidth: 1,
  },
  info: { flex: 1, minWidth: 0 },
  what: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 15,
    letterSpacing: -0.02 * 15,
    lineHeight: 15 * 1.2,
    marginBottom: 3,
  },
  where: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    letterSpacing: 0.01 * 11,
    marginBottom: 5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dateLabel: { fontFamily: fontFamilies.semibold, fontSize: 11 },
  dot: { fontSize: 10 },
  closedWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  closedText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    letterSpacing: letterSpacing.cta * 10,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 6,
  },
  joinBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 32,
    minWidth: 80,
  },
  joinLabel: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 12,
    letterSpacing: letterSpacing.cta * 12,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hostName: { fontFamily: fontFamilies.bold, fontSize: 10, maxWidth: 60 },
  hostAtt: { fontFamily: fontFamilies.bold, fontSize: 9 },
});
