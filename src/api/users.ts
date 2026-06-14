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
 * People search (search_users). Matches name + @handle; the server requires ≥2
 * chars (returns [] otherwise) and applies all privacy/block filtering via the
 * users_public view. Rows arrive as full public profiles → mapPublicUser.
 */
export async function searchUsers(query: string, cursor = 0): Promise<User[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query, p_cursor: cursor });
  if (error) throw error;
  return ((data ?? []) as PublicUserRowFull[]).map(mapPublicUser);
}
