/**
 * usePlanStatus — derives a plan's urgency tier from minutes until start.
 *
 * Encodes the urgency thresholds as a named type rather than raw minutes so
 * that components can branch on intent ('now', 'soon') rather than on numbers.
 * The thresholds (30 min = now, 60 min = soon) are product decisions — change
 * them here if the product definition of "happening now" changes.
 *
 * Pair with useCountdown to get a live-updating urgency state:
 *   const mins = useCountdown(plan.startsAt);
 *   const status = usePlanStatus(mins);
 */
export type PlanUrgencyState = 'now' | 'soon' | 'later' | 'expired';

export function usePlanStatus(mins: number): PlanUrgencyState {
  if (mins < 0) return 'expired';
  if (mins <= 30) return 'now';
  if (mins <= 60) return 'soon';
  return 'later';
}
