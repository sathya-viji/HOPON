import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Notification, NotifType } from '@/types';
import { timeAgo } from '@/utils/time';

interface NotifRowProps {
  notif: Notification;
  onPress: (n: Notification) => void;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onPostRecap?: (planId: string) => void;
}

// Each of the backend's 41 notif types → an existing icon + one of the five
// colour buckets the resolver below understands. Copy itself is server-rendered
// (notif.body); this only drives the avatar-corner badge icon.
const TYPE_ICON: Record<NotifType, { icon: IconName; color: string }> = {
  // plan (host)
  plan_posted: { icon: 'calendar-plus', color: 'textSub' },
  new_joiner: { icon: 'circle-check', color: 'green' },
  join_request: { icon: 'user-plus', color: 'coral' },
  joiner_left: { icon: 'x', color: 'textSub' },
  plan_full: { icon: 'users', color: 'green' },
  plan_starting_soon_host: { icon: 'clock', color: 'amber' },
  plan_started_host: { icon: 'zap', color: 'amber' },
  plan_ended_host: { icon: 'zap', color: 'amber' },
  endorse_reminder: { icon: 'badge-check', color: 'amber' },
  recap_reminder: { icon: 'image', color: 'textSub' },
  plan_cancelled_confirm: { icon: 'x-circle', color: 'textSub' },
  host_marked_absent: { icon: 'alert-triangle', color: 'sponsoredFg' },
  new_recap_on_your_plan: { icon: 'image', color: 'textSub' },
  // plan (joiner)
  request_approved: { icon: 'badge-check', color: 'green' },
  request_declined: { icon: 'x', color: 'sponsoredFg' },
  plan_updated: { icon: 'pencil', color: 'amber' },
  plan_cancelled: { icon: 'x-circle', color: 'sponsoredFg' },
  plan_starting_soon_joiner: { icon: 'clock', color: 'amber' },
  plan_starting_15: { icon: 'clock', color: 'amber' },
  plan_ended_joiner: { icon: 'zap', color: 'amber' },
  marked_noshow: { icon: 'alert-triangle', color: 'sponsoredFg' },
  // chat
  mention: { icon: 'message-circle', color: 'coral' },
  // trust
  endorsement_received: { icon: 'badge-check', color: 'green' },
  attendance_score_improved: { icon: 'zap', color: 'green' },
  attendance_score_dropped: { icon: 'zap', color: 'sponsoredFg' },
  new_familiar_face: { icon: 'users', color: 'textSub' },
  // recaps & stories
  recap_liked: { icon: 'heart', color: 'coral' },
  recap_commented: { icon: 'message-circle', color: 'textSub' },
  recap_comment_replied: { icon: 'message-circle', color: 'textSub' },
  new_recap_from_following: { icon: 'image', color: 'textSub' },
  story_expiring_soon: { icon: 'clock', color: 'amber' },
  // social
  new_follower: { icon: 'user', color: 'textSub' },
  follow_request: { icon: 'user-plus', color: 'coral' },
  follow_accepted: { icon: 'user-check', color: 'green' },
  following_posted_plan: { icon: 'calendar-plus', color: 'textSub' },
  // system
  welcome: { icon: 'sparkles', color: 'coral' },
  profile_incomplete: { icon: 'info', color: 'textSub' },
  first_plan_nudge: { icon: 'sparkles', color: 'amber' },
  contact_joined: { icon: 'user-plus', color: 'textSub' },
  plan_expired_host: { icon: 'clock', color: 'textSub' },
  plan_expired_joiner: { icon: 'clock', color: 'textSub' },
};

export function NotifRow({ notif, onPress, onApprove, onDecline, onPostRecap }: NotifRowProps) {
  const { colors } = useTheme();
  const config = TYPE_ICON[notif.type] ?? { icon: 'bell' as IconName, color: 'textSub' };
  const iconColor =
    config.color === 'green'
      ? colors.green
      : config.color === 'coral'
        ? colors.coral
        : config.color === 'amber'
          ? colors.amber
          : config.color === 'sponsoredFg'
            ? colors.cost.sponsoredFg
            : colors.textSub;

  return (
    <Pressable
      onPress={() => onPress(notif)}
      style={[
        styles.row,
        {
          backgroundColor: notif.isRead ? 'transparent' : colors.unreadRowBg,
          borderBottomColor: colors.surfaceMid,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={notif.body}
    >
      <View style={styles.leftSlot}>
        {notif.actorAvatarUri ? (
          <Avatar uri={notif.actorAvatarUri} name={notif.actorName} size={40} shape="circle" />
        ) : (
          <View
            style={[
              styles.iconBg,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Icon name={config.icon} size={18} color={iconColor} />
          </View>
        )}
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.bg, borderColor: colors.border },
          ]}
        >
          <Icon name={config.icon} size={10} color={iconColor} strokeWidth={2.5} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.body,
            { color: colors.text, fontFamily: notif.isRead ? fontFamilies.semibold : fontFamilies.bold },
          ]}
          numberOfLines={2}
        >
          {notif.body}
        </Text>
        {notif.planLabel ? (
          <Text style={[styles.planLabel, { color: colors.textSub }]} numberOfLines={1}>
            {notif.planLabel}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: colors.textSub }]}>{timeAgo(notif.createdAt)}</Text>

        {notif.type === 'join_request' && !notif.isRead && onApprove && onDecline ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => onApprove(notif.id)}
              style={[styles.actionBtn, { backgroundColor: colors.ctaBg }]}
            >
              <Icon name="check" size={11} color={colors.ctaFg} strokeWidth={2.5} />
              <Text style={[styles.actionText, { color: colors.ctaFg }]}>Approve</Text>
            </Pressable>
            <Pressable
              onPress={() => onDecline(notif.id)}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Icon name="x" size={11} color={colors.textSub} />
              <Text style={[styles.actionText, { color: colors.textSub }]}>Decline</Text>
            </Pressable>
          </View>
        ) : null}

        {notif.type === 'plan_ended_host' && !notif.isRead && onPostRecap && notif.planId ? (
          <View style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => onPostRecap(notif.planId!)}
              style={[styles.actionBtn, { backgroundColor: colors.cost.copayBg, alignSelf: 'flex-start' }]}
            >
              <Icon name="image-plus" size={11} color={colors.amber} />
              <Text style={[styles.actionText, { color: colors.amber }]}>Post recap</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {!notif.isRead ? <View style={[styles.unreadDot, { backgroundColor: colors.coral }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.screenPx,
    borderBottomWidth: 1,
    alignItems: 'flex-start',
  },
  leftSlot: { width: 42, height: 42, position: 'relative' },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { fontSize: 13, lineHeight: 13 * 1.5, marginBottom: 2 },
  planLabel: { fontFamily: fontFamilies.medium, fontSize: 11, marginBottom: 4 },
  time: { fontFamily: fontFamilies.regular, fontSize: 10 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  actionText: { fontFamily: fontFamilies.bold, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
});
