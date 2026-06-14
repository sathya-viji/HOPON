/**
 * Plan domain types — the core data model for the HopOn plan lifecycle.
 *
 * CostType drives both UI badge colours (colors.cost.*) and plan creation form
 * defaults. GenderPref is used for matching and filtering, not for display alone.
 * PlanType 'closed' means joiners require host approval before attending.
 * MemberStatus tracks a specific user's progression through a plan's lifecycle.
 *
 * minutesUntilStart is a derived field included in the API response for
 * convenience — it avoids every client recalculating from startsAt. Use
 * useCountdown(plan.startsAt) for a live-updating value in UI.
 */
export type CostType = 'free' | 'copay' | 'sponsored' | 'seeking';
export type GenderPref = 'all' | 'women' | 'men';
export type PlanType = 'open' | 'closed';
export type PlanStatus = 'active' | 'full' | 'cancelled' | 'expired' | 'ended';
export type UrgencyTier = 'now' | 'soon' | 'later';
export type MemberStatus = 'joined' | 'requested' | 'approved' | 'declined' | 'attended' | 'noshow';

/**
 * Lightweight host summary embedded on Plan by the API mapper, so list rows can
 * render the host without a separate user lookup. Mock-sourced plans omit it
 * and fall back to the mock user directory (PlanRow).
 */
export interface PlanHostSummary {
  id: string;
  name: string;
  avatarUri?: string;
  attendanceScore: number | null;
}

export interface Plan {
  id: string;
  activity: string;
  categoryId: string;
  location: string;
  lat: number;
  lng: number;
  startsAt: string;
  minutesUntilStart: number;
  capacity: number;
  spotsRemaining: number;
  type: PlanType;
  status: PlanStatus;
  cost: CostType;
  costNote?: string;
  genderPref: GenderPref;
  hostId: string;
  joinerIds: string[];
  description?: string;
  rules?: string;
  isMine?: boolean;
  /** Viewer is in this plan's joiner set (API-derived; mock plans omit it). */
  viewerJoined?: boolean;
  /** Embedded host summary from the API; mock plans resolve via the mock dir. */
  host?: PlanHostSummary;
}
