/**
 * Plan display utilities — pure functions that derive display values from
 * plan domain types. No React, no side effects.
 *
 * getCostLabel: returns the user-facing label for a cost type. For 'copay',
 * the plan's costNote overrides the generic label (e.g. "₹200 split").
 *
 * getSpotsVariant: drives the visual urgency of the spots badge.
 * 'critical' (1 spot) triggers a more prominent colour treatment than 'normal'.
 */
import { CostType, GenderPref, Plan, UrgencyTier } from '@/types';

/**
 * Picks the right detail screen for a plan based on its lifecycle status.
 * Upcoming plans open the live detail screen (or the host view for the
 * current user's own plans); finished plans open their terminal screens.
 */
export function planDetailRoute(
  plan: Plan,
  ownHostView = false,
): 'Plan' | 'PlanHost' | 'PlanEnded' | 'PlanExpired' {
  if (plan.status === 'ended') return 'PlanEnded';
  if (plan.status === 'expired') return 'PlanExpired';
  // Auto lifecycle-end ~1h after start (no manual end / cron yet).
  if (isWrappedUp(plan)) return 'PlanEnded';
  return ownHostView ? 'PlanHost' : 'Plan';
}

/** A plan auto-enters its Trust lifecycle ~1h after it starts (there is no
 *  manual "end" — the host's first attendance submission lazily ends it). */
const WRAP_UP_MS = 60 * 60 * 1000;
export function isWrappedUp(plan: Plan): boolean {
  return Date.now() >= new Date(plan.startsAt).getTime() + WRAP_UP_MS;
}

export function deriveUrgency(mins: number): UrgencyTier {
  if (mins <= 30) return 'now';
  if (mins <= 60) return 'soon';
  return 'later';
}

export function getCostLabel(type: CostType, note?: string): string {
  switch (type) {
    case 'free':
      return 'Free';
    case 'copay':
      return note ?? 'Co-pay';
    case 'sponsored':
      return 'Sponsored';
    case 'seeking':
      return 'Seeking sponsor';
  }
}

export function getGenderLabel(pref: GenderPref): string {
  switch (pref) {
    case 'women':
      return 'Women only';
    case 'men':
      return 'Men only';
    case 'all':
      return 'Everyone';
  }
}

export type SpotsVariant = 'normal' | 'critical' | 'full';

export function getSpotsVariant(remaining: number): SpotsVariant {
  if (remaining <= 0) return 'full';
  if (remaining <= 1) return 'critical';
  return 'normal';
}
