/**
 * User read API. getMyProfile returns the signed-in user's own public profile
 * (visible to self via the users_public RLS). Used where a screen shows the
 * viewer's own trust stats (e.g. the request-sent confirmation).
 */
import { supabase } from './client';
import { mapPublicUser, type PublicUserRowFull } from './mappers';
import type { User } from '@/types';

export async function getMyProfile(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('users_public')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPublicUser(data as PublicUserRowFull) : null;
}

/**
 * Another user's public profile via the users_public view. Returns null when
 * the profile isn't visible to the viewer — i.e. the user is blocked (either
 * direction), deleted/banned, or followers-only and the viewer doesn't follow
 * them. Callers distinguish these cases with the follow/block state.
 */
export async function getPublicProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users_public')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPublicUser(data as PublicUserRowFull) : null;
}

/** Editable own-profile fields (matches the columns `authenticated` may UPDATE). */
export interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  neighbourhood?: string;
  avatarPath?: string | null;
  profileVisibility?: User['profileVisibility'];
  planVisibility?: User['planVisibility'];
  instagram?: string | null;
  linkedin?: string | null;
  facebook?: string | null;
}

/**
 * Update the signed-in user's profile. Only name/avatar/bio/neighbourhood/
 * visibility/social links are editable (handle, gender, and dob are immutable —
 * the GRANT on `users` doesn't expose those columns to clients).
 */
export async function updateMyProfile(patch: ProfileUpdate): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error('not_authenticated');

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.neighbourhood !== undefined) row.neighbourhood = patch.neighbourhood;
  if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath;
  if (patch.profileVisibility !== undefined) row.profile_visibility = patch.profileVisibility;
  if (patch.planVisibility !== undefined) row.plan_visibility = patch.planVisibility;
  if (patch.instagram !== undefined) row.ig_handle = patch.instagram;
  if (patch.linkedin !== undefined) row.linkedin_handle = patch.linkedin;
  if (patch.facebook !== undefined) row.fb_handle = patch.facebook;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('users').update(row).eq('id', uid);
  if (error) throw error;
}

/**
 * People search (search_users). Matches name + @handle; the server requires ≥2
 * chars (returns [] otherwise) and applies all privacy/block filtering via the
 * users_public view. Rows arrive as full public profiles → mapPublicUser.
 */
export async function searchUsers(query: string, cursor = 0): Promise<User[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query, p_cursor: cursor });
  if (error) throw error;
  return ((data ?? []) as PublicUserRowFull[]).map(mapPublicUser);
}
