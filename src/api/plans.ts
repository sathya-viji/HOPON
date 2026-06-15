/**
 * Plans API — read/mutation RPCs for the core plan loop (Wave 2).
 *
 * All mutations are RPC-only (backend rule); reads go through the
 * security-definer discovery RPCs (get_home_feed / get_plan_detail), never
 * direct table selects. Rows are mapped to view-models in mappers.ts.
 */
import { supabase } from './client';
import { mapFeedItemToPlan, mapPlanDetail, type FeedItem, type PlanDetail, type PlanDetailRow } from './mappers';
import { avatarUrl } from './storage';
import type { Plan, CostType, GenderPref, PlanType, MemberStatus } from '@/types';

export interface HomeFeedParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  filters?: {
    categoryId?: string;
    cost?: string;
    planType?: string;
    genderPref?: string;
    limit?: number;
  };
  cursor?: number;
}

/** The signed-in user's id (for isMine / joined derivation), or null. */
async function viewerId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Home feed: active+full, future, visibility-filtered plans, soonest first.
 * With no lat/lng the server skips the geo filter and returns all visible plans.
 */
export async function getHomeFeed(params: HomeFeedParams = {}): Promise<Plan[]> {
  const f = params.filters ?? {};
  const p_filters: Record<string, unknown> = {};
  if (f.categoryId) p_filters.category_id = f.categoryId;
  if (f.cost) p_filters.cost = f.cost;
  if (f.planType) p_filters.plan_type = f.planType;
  if (f.genderPref) p_filters.gender_pref = f.genderPref;
  if (f.limit != null) p_filters.limit = f.limit;

  const [{ data, error }, uid] = await Promise.all([
    supabase.rpc('get_home_feed', {
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_radius_km: params.radiusKm ?? 50,
      p_filters,
      p_cursor: params.cursor ?? 0,
    }),
    viewerId(),
  ]);

  if (error) throw error;
  return ((data ?? []) as FeedItem[]).map((item) => mapFeedItemToPlan(item, uid));
}

/**
 * Full-text plan search (search_plans). Empty query returns nothing server-side
 * (tsquery), so callers should fall back to getHomeFeed for the browse state.
 */
export async function searchPlans(
  query: string,
  filters?: { categoryId?: string },
  cursor = 0,
): Promise<Plan[]> {
  const p_filters: Record<string, unknown> = {};
  if (filters?.categoryId) p_filters.category_id = filters.categoryId;
  const [{ data, error }, uid] = await Promise.all([
    supabase.rpc('search_plans', { p_query: query, p_filters, p_cursor: cursor }),
    viewerId(),
  ]);
  if (error) throw error;
  return ((data ?? []) as FeedItem[]).map((item) => mapFeedItemToPlan(item, uid));
}

// ─── Plan detail + membership ───────────────────────────────────────────────

/** Full plan detail for the Plan screen (host + joiners + viewer relationship). */
export async function getPlanDetail(planId: string): Promise<PlanDetail> {
  const [{ data, error }, uid] = await Promise.all([
    supabase.rpc('get_plan_detail', { p_plan_id: planId }),
    viewerId(),
  ]);
  if (error) throw error;
  return mapPlanDetail(data as PlanDetailRow, uid);
}

/**
 * Join (open) or request (closed). Naturally idempotent: the (plan_id,user_id)
 * unique + the RPC's "already a member" short-circuit mean a retry returns the
 * existing membership rather than double-joining. Returns the resulting status.
 */
export async function joinPlan(planId: string): Promise<MemberStatus> {
  const { data, error } = await supabase.rpc('join_plan', { p_plan_id: planId });
  if (error) throw error;
  return ((data as { status?: MemberStatus } | null)?.status ?? 'joined') as MemberStatus;
}

export async function leavePlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_plan', { p_plan_id: planId });
  if (error) throw error;
}

// ─── Host mutations ─────────────────────────────────────────────────────────

export interface CreatePlanInput {
  categoryId: string;
  activity: string;
  locationLabel: string;
  lat: number;
  lng: number;
  startsAt: string;       // ISO timestamptz
  capacity: number;       // INCLUDES the host (joinable = capacity − 1)
  planType: PlanType;
  cost: CostType;
  genderPref: GenderPref;
  costNote?: string;
  description?: string;
  rules?: string;
}

/** Create a plan. Server enforces 14-day window, ≤5 active, future start. */
export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const { data, error } = await supabase.rpc('create_plan', {
    p_category_id: input.categoryId,
    p_activity: input.activity,
    p_location_label: input.locationLabel,
    p_lat: input.lat,
    p_lng: input.lng,
    p_starts_at: input.startsAt,
    p_capacity: input.capacity,
    p_plan_type: input.planType,
    p_cost: input.cost,
    p_gender_pref: input.genderPref,
    p_cost_note: input.costNote ?? null,
    p_description: input.description ?? null,
    p_rules: input.rules ?? null,
  });
  if (error) throw error;
  const uid = await viewerId();
  // create_plan returns a bare plans row; map with self as host, no joiners yet.
  return mapFeedItemToPlan({ plan: data, host: null, joiners: [] } as FeedItem, uid);
}

export interface UpdatePlanInput {
  planId: string;
  activity: string;
  locationLabel: string;
  lat: number;
  lng: number;
  startsAt: string;
  cost: CostType;
  genderPref: GenderPref;
  costNote?: string;
  description?: string;
  rules?: string;
  // NOTE: capacity is intentionally absent — update_plan cannot change it.
}

export async function updatePlan(input: UpdatePlanInput): Promise<Plan> {
  const { data, error } = await supabase.rpc('update_plan', {
    p_plan_id: input.planId,
    p_activity: input.activity,
    p_location_label: input.locationLabel,
    p_lat: input.lat,
    p_lng: input.lng,
    p_starts_at: input.startsAt,
    p_cost: input.cost,
    p_gender_pref: input.genderPref,
    p_cost_note: input.costNote ?? null,
    p_description: input.description ?? null,
    p_rules: input.rules ?? null,
  });
  if (error) throw error;
  const uid = await viewerId();
  return mapFeedItemToPlan({ plan: data, host: null, joiners: [] } as FeedItem, uid);
}

export async function cancelPlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_plan', { p_plan_id: planId });
  if (error) throw error;
}

export async function approveRequest(planId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_request', { p_plan_id: planId, p_user_id: userId });
  if (error) throw error;
}

export async function declineRequest(planId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_request', { p_plan_id: planId, p_user_id: userId });
  if (error) throw error;
}

// ─── Host member reads (host RLS on plan_members + users_public) ─────────────

export interface PlanMemberSummary {
  id: string;
  name: string;
  avatarUri?: string;
  attendanceScore: number | null;
  plansAttended: number;
  status: MemberStatus;
}

interface PlanMemberRow {
  user_id: string;
  status: MemberStatus;
  joined_at: string;
  name: string | null;
  avatar_path: string | null;
  attendance_score: number | null;
  plans_attended: number | null;
}

/**
 * All non-host members of a plan (host-only). Reads through the
 * `get_plan_members` security-definer RPC, which authorizes the caller as the
 * plan host and bypasses the plan_members → plans_select → users RLS cascade
 * (that cascade touches `users` columns `authenticated` can't SELECT, which
 * otherwise threw "permission denied for table users"). Profiles come from
 * users_public inside the RPC; a member whose profile isn't visible falls back
 * to a neutral label. Callers filter by status (requested = pending,
 * joined/approved = attendees).
 */
export async function getPlanMembers(planId: string): Promise<PlanMemberSummary[]> {
  const { data, error } = await supabase.rpc('get_plan_members', { p_plan_id: planId });
  if (error) throw error;

  return ((data ?? []) as PlanMemberRow[]).map((m) => ({
    id: m.user_id,
    name: m.name ?? 'Member',
    avatarUri: avatarUrl(m.avatar_path),
    attendanceScore: m.attendance_score ?? null,
    plansAttended: m.plans_attended ?? 0,
    status: m.status,
  }));
}

// ─── My plans (for the recap / story pickers + own profile history) ─────────

/** A full plan view-model + `started` (has the start time passed?). */
export type MyPlanItem = Plan & { started: boolean };

/**
 * Plans the signed-in user hosts or is an active member of, soonest-started
 * first. `plan.isMine` distinguishes hosted from joined.
 *
 * ⚠️ KNOWN BACKEND GAP (Wave 5): there is NO server read-path for "a user's
 * plans". Direct selects on `plans` / `plan_members` fail for `authenticated`
 * with 42501 "permission denied for table users" — the plans_select RLS policy's
 * subquery touches `users.deleted_at` / `users.account_status`, columns not in
 * the column-level GRANT (the users-column-privilege cascade). All plan reads
 * are designed to go through SECURITY DEFINER RPCs (get_home_feed / search_plans
 * / get_plan_detail), none of which return "my plans" (the feed is geo +
 * active+future only). So this throws today and callers fall back to empty.
 *
 * FIX (needs backend approval — a new migration, hence flagged not done):
 * add a SECURITY DEFINER `get_my_plans()` RPC (mirrors get_plan_attendees'
 * pattern) returning the caller's hosted + member plans. Once it exists, swap
 * the body to a single `supabase.rpc('get_my_plans')` call.
 */
export async function getMyPlans(): Promise<MyPlanItem[]> {
  const uid = await viewerId();
  if (!uid) return [];

  const { data: memberRows, error: mErr } = await supabase
    .from('plan_members')
    .select('plan_id')
    .eq('user_id', uid);
  if (mErr) throw mErr; // 42501 today — see gap note above
  const memberPlanIds = (memberRows ?? []).map((r) => (r as { plan_id: string }).plan_id);

  const [hostedRes, memberRes] = await Promise.all([
    supabase.from('plans').select('*').eq('host_id', uid),
    memberPlanIds.length
      ? supabase.from('plans').select('*').in('id', memberPlanIds)
      : Promise.resolve({ data: [] as FeedItem['plan'][], error: null }),
  ]);
  if (hostedRes.error) throw hostedRes.error;
  if (memberRes.error) throw memberRes.error;

  const byId = new Map<string, FeedItem['plan']>();
  for (const p of [...(hostedRes.data ?? []), ...(memberRes.data ?? [])] as FeedItem['plan'][]) {
    byId.set(p.id, p);
  }

  const now = Date.now();
  return Array.from(byId.values())
    .map((p) => {
      const plan = mapFeedItemToPlan({ plan: p, host: null, joiners: [] }, uid);
      return { ...plan, started: new Date(plan.startsAt).getTime() <= now };
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

/**
 * Plans hosted by a given user, newest first — for the ProfileOther "Hosted"
 * tab.
 *
 * ⚠️ Same KNOWN BACKEND GAP as getMyPlans: a direct `plans` select fails for
 * `authenticated` with 42501 (users-column-privilege cascade), so this throws
 * today and the tab falls back to empty. Needs a SECURITY DEFINER
 * `get_user_plans(p_user_id)` RPC (flagged, not done — new migration).
 * (Another user's JOINED plans are not exposable at all — plan_members RLS only
 * covers the viewer's own membership.)
 */
export async function getUserHostedPlans(userId: string): Promise<Plan[]> {
  const uid = await viewerId();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('host_id', userId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as FeedItem['plan'][]).map((p) =>
    mapFeedItemToPlan({ plan: p, host: null, joiners: [] }, uid),
  );
}
