/**
 * Notifications API — Wave 3.
 *
 * Reads go through the `get_notifications` security-definer RPC (own rows, with
 * the actor's public profile embedded). The unread count is a cheap own-row
 * COUNT (notifications RLS is `user_id = auth.uid()`, no users-column cascade).
 * Writes (mark-read, push-token) are RPC-only. The notification copy (`body`)
 * is rendered server-side; the client only maps type → icon / nav target.
 */
import { supabase } from './client';
import { avatarUrl } from './storage';
import type { Notification, NotifType } from '@/types';

interface NotifActorRow {
  id: string;
  name: string;
  avatar_path: string | null;
}

interface NotifRow {
  id: string;
  type: NotifType;
  is_read: boolean;
  body: string;
  plan_id: string | null;
  recap_id: string | null;
  created_at: string;
  actor: NotifActorRow | null;
}

function mapNotification(row: NotifRow): Notification {
  return {
    id: row.id,
    type: row.type,
    isRead: row.is_read,
    body: row.body,
    createdAt: row.created_at,
    planId: row.plan_id ?? undefined,
    recapId: row.recap_id ?? undefined,
    userId: row.actor?.id,
    actorName: row.actor?.name,
    actorAvatarUri: avatarUrl(row.actor?.avatar_path ?? null),
  };
}

/** The notification feed for the current user, newest first. */
export async function getNotifications(cursor = 0, limit = 30): Promise<Notification[]> {
  const { data, error } = await supabase.rpc('get_notifications', { p_cursor: cursor, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as NotifRow[]).map(mapNotification);
}

/** Count of the current user's unread notifications (own-row RLS COUNT). */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Mark notifications read. With no ids, marks ALL of the user's unread.
 * Returns the number newly marked read.
 */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** Register an Expo/device push token for the current user (one row per token). */
export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: platform });
  if (error) throw error;
}
