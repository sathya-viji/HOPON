/**
 * Trust API — Wave 4 (Phase 4 backend).
 *
 * Endorsements, attendance marking, familiar faces, attendance score. Mutations
 * are RPC-only (`end_plan`, `submit_endorsements`, `vote_host_noshow`). Reads use
 * own-row RLS directly (familiar_faces / endorsements are user-scoped, no
 * users-column cascade) or the `get_endorsement_summary` RPC.
 *
 * Lifecycle note (product): there is no manual "end plan" button — a plan is
 * treated as wrapped up ~1h after its start (see utils/plan). The host's first
 * attendance submission lazily calls `end_plan` (sets ended_at + notifies the
 * crew), then `submit_endorsements`.
 */
import { supabase } from './client';
import { mapPublicUser, type PublicUserRowFull } from './mappers';
import { avatarUrl } from './storage';
import type { User } from '@/types';

/** One entry in the submit_endorsements payload. `result` is host-only. */
export interface EndorseMark {
  subject_id: string;
  result?: 'present' | 'noshow';
  tag?: string;
}

export interface EndorsementCount {
  label: string;
  count: number;
}

export interface FamiliarFace {
  user: User;
  plansTogether: number;
  lastMetAt: string;
}

/** Host ends a plan (sets ended_at, marks host present, notifies the crew). */
export async function endPlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc('end_plan', { p_plan_id: planId });
  if (error) throw error;
}

/**
 * Submit attendance marks (host-only `result`) and/or endorsement tags
 * (host or present peer). marks = [{ subject_id, result?, tag? }].
 */
export async function submitEndorsements(planId: string, marks: EndorseMark[]): Promise<void> {
  const { error } = await supabase.rpc('submit_endorsements', { p_plan_id: planId, p_marks: marks });
  if (error) throw error;
}

/** Peer report that the host was a no-show (D7 quorum). */
export async function voteHostNoshow(planId: string): Promise<void> {
  const { error } = await supabase.rpc('vote_host_noshow', { p_plan_id: planId });
  if (error) throw error;
}

interface AttendeeRow {
  user_id: string; is_host: boolean; name: string | null; avatar_path: string | null;
  my_result?: 'present' | 'noshow' | null; my_tag?: string | null;
}
export interface PlanAttendee {
  id: string; name: string; avatarUri?: string; isHost: boolean;
  // The viewer's existing mark for this person (null until they've submitted).
  myResult?: 'present' | 'noshow' | null; myTag?: string | null;
}

/**
 * Full participant set of an ENDED plan (host + members, incl. the caller), for
 * the Trust v2 default-present Endorse flow — everyone marks everyone. Reads the
 * get_plan_attendees RPC (migration 0014s).
 */
export async function getPlanAttendees(planId: string): Promise<PlanAttendee[]> {
  const { data, error } = await supabase.rpc('get_plan_attendees', { p_plan_id: planId });
  if (error) throw error;
  return ((data ?? []) as AttendeeRow[]).map((a) => ({
    id: a.user_id,
    name: a.name ?? 'Member',
    avatarUri: avatarUrl(a.avatar_path),
    isHost: a.is_host,
    myResult: a.my_result ?? null,
    myTag: a.my_tag ?? null,
  }));
}

/**
 * The signed-in viewer's shared-plan history with one other user (for the
 * ProfileOther "N plans together" banner), or null if they've never been
 * resolved-present at the same plan. Reads own familiar_faces rows (RLS-scoped).
 */
export async function getFamiliarFaceWith(
  userId: string,
): Promise<{ plansTogether: number; lastMetAt: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('familiar_faces')
    .select('user_a_id,user_b_id,plans_together,last_met_at')
    .or(`and(user_a_id.eq.${uid},user_b_id.eq.${userId}),and(user_a_id.eq.${userId},user_b_id.eq.${uid})`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as FamiliarFaceRow;
  return { plansTogether: r.plans_together, lastMetAt: r.last_met_at };
}

/** Top-5 endorsement tags + counts for a user (DB-aggregated). */
export async function getEndorsementSummary(userId: string): Promise<EndorsementCount[]> {
  const { data, error } = await supabase.rpc('get_endorsement_summary', { p_user_id: userId });
  if (error) throw error;
  return ((data ?? []) as { tag: string; count: number }[]).map((r) => ({ label: r.tag, count: r.count }));
}

interface FamiliarFaceRow {
  user_a_id: string;
  user_b_id: string;
  plans_together: number;
  last_met_at: string;
}

/**
 * The signed-in user's familiar faces (people they've shared a plan with),
 * newest-met first. Reads own rows from familiar_faces (RLS-scoped to self),
 * then resolves the *other* party's public profile.
 */
export async function getFamiliarFaces(): Promise<FamiliarFace[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];

  const { data: rows, error } = await supabase
    .from('familiar_faces')
    .select('user_a_id,user_b_id,plans_together,last_met_at')
    .order('last_met_at', { ascending: false });
  if (error) throw error;

  const pairs = (rows ?? []) as FamiliarFaceRow[];
  const otherId = (r: FamiliarFaceRow) => (r.user_a_id === uid ? r.user_b_id : r.user_a_id);
  const ids = pairs.map(otherId);
  if (ids.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('users_public')
    .select('*')
    .in('id', ids);
  if (pErr) throw pErr;

  const byId = new Map((profiles as PublicUserRowFull[] | null ?? []).map((p) => [p.id, p]));
  return pairs
    .map((r) => {
      const p = byId.get(otherId(r));
      return p
        ? { user: mapPublicUser(p), plansTogether: r.plans_together, lastMetAt: r.last_met_at }
        : null;
    })
    .filter((f): f is FamiliarFace => f !== null);
}
