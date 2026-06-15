/**
 * Safety API — Wave 5 (Phase 6 backend): reports + blocks.
 *
 * submit_report routes into a moderation queue (client never reads status back)
 * and is rate-limited to 10/day → raises `rate_limited`. Auto-moderation kicks
 * in server-side (3 distinct safety_concern reports on a user → 7-day suspend;
 * 5 distinct reports on a plan → auto-hide).
 *
 * block_user is one-directional, removes any follow edges both ways, and hides
 * each user from the other everywhere (via is_blocked_pair across the RLS
 * surface). Note: because blocked users are filtered out of users_public, the
 * client cannot resolve a blocked user's name/avatar — the block LIST shows
 * generic entries (documented gap; would need a dedicated read RPC).
 */
import { supabase } from './client';

/** Mirrors report_target_t (extended for per-content reporting in 0002a). */
export type ReportTarget = 'user' | 'plan' | 'recap' | 'story' | 'comment' | 'message';

/** Mirrors report_reason_t. */
export type ReportReasonValue =
  | 'spam'
  | 'harassment'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'no_show'
  | 'safety_concern'
  | 'emergency'
  | 'other';

/** Submit a report. Throws `rate_limited` after 10 in a day. */
export async function submitReport(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReasonValue,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_notes: notes?.trim() ? notes.trim() : null,
  });
  if (error) throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

export interface BlockedEntry {
  userId: string;
  blockedAt: string;
}

/**
 * Ids of users the signed-in user has blocked, newest first. Names/avatars are
 * NOT resolvable (blocked users are excluded from users_public), so the UI shows
 * generic entries with an unblock action.
 */
export async function getBlockedUsers(): Promise<BlockedEntry[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id,created_at')
    .eq('blocker_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { blocked_id: string; created_at: string }[]).map((b) => ({
    userId: b.blocked_id,
    blockedAt: b.created_at,
  }));
}

/** Whether the signed-in user has blocked a specific user. */
export async function isBlocked(userId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', uid)
    .eq('blocked_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
