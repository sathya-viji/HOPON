/**
 * Mappers — translate snake_case backend rows into the camelCase view-models
 * the screens already consume (src/types/*). This is where the A.0 contract
 * deltas are absorbed so screens keep their existing prop shapes.
 *
 * Derived fields the backend doesn't send (added here for UI convenience):
 *   - minutesUntilStart  (from starts_at; UI uses useCountdown for live values)
 *   - isMine             (host_id === viewer)
 *   - viewerJoined       (viewer is in the joiner set)
 *   - host               (embedded summary so PlanRow needn't look the host up)
 */
import type { Plan, PlanHostSummary, MemberStatus, User } from '@/types';
import { avatarUrl } from './storage';

/** Shape of a single row in to_jsonb(plans) (the columns get_home_feed returns). */
interface PlanRow {
  id: string;
  host_id: string;
  category_id: string;
  activity: string;
  description: string | null;
  rules: string | null;
  location_label: string;
  lat: number | string;
  lng: number | string;
  starts_at: string;
  capacity: number;
  spots_remaining: number;
  plan_type: Plan['type'];
  status: Plan['status'];
  cost: Plan['cost'];
  cost_note: string | null;
  gender_pref: Plan['genderPref'];
}

/** users_public row (subset we use) + the joiner mini-rows. */
interface PublicUserRow {
  id: string;
  name: string;
  avatar_path: string | null;
  attendance_score: number | null;
}

/** Full users_public row (all exposed columns). */
export interface PublicUserRowFull extends PublicUserRow {
  handle: string;
  neighbourhood: string;
  bio: string | null;
  verification_level: 'none' | 'phone' | 'id';
  profile_visibility: User['profileVisibility'];
  plan_visibility: User['planVisibility'];
  ig_handle: string | null;
  linkedin_handle: string | null;
  fb_handle: string | null;
  plans_hosted: number;
  plans_attended: number;
  people_met: number;
  interests: string[] | null;
}

/** Map a full users_public row → the User view-model. Fields not on the public
 *  view (familiar faces, endorsements) default empty — filled by their own RPCs. */
export function mapPublicUser(row: PublicUserRowFull): User {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    avatarUri: avatarUrl(row.avatar_path),
    neighbourhood: row.neighbourhood,
    attendanceScore: row.attendance_score,
    isVerified: row.verification_level !== 'none',
    bio: row.bio ?? undefined,
    interests: row.interests ?? [],
    socialLinks: {
      instagram: row.ig_handle ?? undefined,
      linkedin: row.linkedin_handle ?? undefined,
      facebook: row.fb_handle ?? undefined,
    },
    plansHosted: row.plans_hosted,
    plansAttended: row.plans_attended,
    peopleMet: row.people_met,
    familiarFaceIds: [],
    endorsements: [],
    profileVisibility: row.profile_visibility,
    planVisibility: row.plan_visibility,
  };
}

/** One element of the get_home_feed / search_plans JSONB array. */
export interface FeedItem {
  plan: PlanRow;
  host: PublicUserRow | null;
  joiners: PublicUserRow[];
  distance_m?: number | null;
}

function mapHost(row: PublicUserRow | null): PlanHostSummary | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    avatarUri: avatarUrl(row.avatar_path),
    attendanceScore: row.attendance_score,
  };
}

/** get_plan_detail result: a feed item + viewer-relative fields. */
export interface PlanDetailRow extends FeedItem {
  familiar_count: number;
  viewer_is_host: boolean;
  viewer_membership: string | null;
}

/** Plan detail view-model — the Plan plus the viewer's relationship to it. */
export interface PlanDetail {
  plan: Plan;
  host: User | null;
  joiners: PlanHostSummary[];
  familiarCount: number;
  viewerIsHost: boolean;
  viewerMembership: MemberStatus | null;
}

/** Map get_plan_detail → PlanDetail. Server flags are authoritative over derived. */
export function mapPlanDetail(row: PlanDetailRow, viewerId: string | null): PlanDetail {
  const plan = mapFeedItemToPlan(row, viewerId);
  const membership = (row.viewer_membership ?? null) as MemberStatus | null;
  plan.isMine = row.viewer_is_host;
  plan.viewerJoined = membership === 'joined' || membership === 'approved';
  return {
    plan,
    host: row.host ? mapPublicUser(row.host as PublicUserRowFull) : null,
    joiners: (row.joiners ?? []).map((j) => ({
      id: j.id,
      name: j.name,
      avatarUri: avatarUrl(j.avatar_path),
      attendanceScore: j.attendance_score,
    })),
    familiarCount: row.familiar_count ?? 0,
    viewerIsHost: row.viewer_is_host,
    viewerMembership: membership,
  };
}

/** Map one feed item → the Plan view-model, given the viewing user's id. */
export function mapFeedItemToPlan(item: FeedItem, viewerId: string | null): Plan {
  const p = item.plan;
  const joinerIds = (item.joiners ?? []).map((j) => j.id);
  const minutesUntilStart = Math.round((new Date(p.starts_at).getTime() - Date.now()) / 60_000);

  return {
    id: p.id,
    activity: p.activity,
    categoryId: p.category_id,
    location: p.location_label,
    lat: Number(p.lat),
    lng: Number(p.lng),
    startsAt: p.starts_at,
    minutesUntilStart,
    capacity: p.capacity,
    spotsRemaining: p.spots_remaining,
    type: p.plan_type,
    status: p.status,
    cost: p.cost,
    costNote: p.cost_note ?? undefined,
    genderPref: p.gender_pref,
    hostId: p.host_id,
    joinerIds,
    description: p.description ?? undefined,
    rules: p.rules ?? undefined,
    isMine: viewerId != null && p.host_id === viewerId,
    viewerJoined: viewerId != null && joinerIds.includes(viewerId),
    host: mapHost(item.host),
  };
}
