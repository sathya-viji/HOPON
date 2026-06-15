/**
 * Follows API — Wave 5 (Phase 5 backend).
 *
 * Following is one-directional and gated by the target's profile visibility:
 *   - profile_visibility 'everyone'   → follow is auto-accepted
 *   - profile_visibility 'followers'  → follow is 'pending' until they accept
 *   - profile_visibility 'nobody'     → cannot follow (RPC raises cannot_follow)
 *
 * Mutations are RPC-only. Reads come straight from the `follows` table (RLS
 * exposes rows where the viewer is the follower OR the following), joined to
 * users_public for display. Because RLS only returns rows involving the viewer,
 * follower/following LISTS are only available for the signed-in user — another
 * user's lists are not queryable from the client (no read RPC; documented gap).
 */
import { supabase } from './client';
import { mapPublicUser, type PublicUserRowFull } from './mappers';
import type { User } from '@/types';

export type FollowState = 'none' | 'pending' | 'accepted';

/** Follow a user. Returns the resulting state ('accepted' or 'pending'). */
export async function followUser(userId: string): Promise<FollowState> {
  const { data, error } = await supabase.rpc('follow_user', { p_user_id: userId });
  if (error) throw error;
  return (data as { status: FollowState }).status;
}

export async function acceptFollow(followerId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_follow', { p_follower_id: followerId });
  if (error) throw error;
}

export async function declineFollow(followerId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_follow', { p_follower_id: followerId });
  if (error) throw error;
}

export async function unfollow(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unfollow', { p_user_id: userId });
  if (error) throw error;
}

async function myUid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** The viewer's relationship to another user (do I follow them, and is it accepted?). */
export async function getFollowState(userId: string): Promise<FollowState> {
  const uid = await myUid();
  if (!uid) return 'none';
  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', uid)
    .eq('following_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as FollowState | undefined) ?? 'none';
}

export interface FollowEntry {
  user: User;
  status: FollowState;
}

interface FollowRow {
  follower_id: string;
  following_id: string;
  status: FollowState;
}

/** Resolve a set of user ids → User view-models via users_public (visibility-filtered). */
async function resolveUsers(ids: string[]): Promise<Map<string, User>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('users_public').select('*').in('id', ids);
  if (error) throw error;
  return new Map((data as PublicUserRowFull[] | null ?? []).map((p) => [p.id, mapPublicUser(p)]));
}

/**
 * The signed-in user's followers (people who follow ME), including pending
 * requests (so the UI can offer accept/decline). Newest first.
 */
export async function getMyFollowers(): Promise<FollowEntry[]> {
  const uid = await myUid();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id,following_id,status')
    .eq('following_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as FollowRow[];
  const users = await resolveUsers(rows.map((r) => r.follower_id));
  return rows
    .map((r) => { const u = users.get(r.follower_id); return u ? { user: u, status: r.status } : null; })
    .filter((e): e is FollowEntry => e !== null);
}

/** The signed-in user's following (people I follow), accepted + pending. Newest first. */
export async function getMyFollowing(): Promise<FollowEntry[]> {
  const uid = await myUid();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id,following_id,status')
    .eq('follower_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as FollowRow[];
  const users = await resolveUsers(rows.map((r) => r.following_id));
  return rows
    .map((r) => { const u = users.get(r.following_id); return u ? { user: u, status: r.status } : null; })
    .filter((e): e is FollowEntry => e !== null);
}

/** Follower / following counts for the signed-in user (own rows only). */
export async function getMyFollowCounts(): Promise<{ followers: number; following: number }> {
  const uid = await myUid();
  if (!uid) return { followers: 0, following: 0 };
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', uid).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', uid).eq('status', 'accepted'),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

/** Number of pending follow requests awaiting the signed-in user's decision. */
export async function getPendingRequestCount(): Promise<number> {
  const uid = await myUid();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', uid)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}
