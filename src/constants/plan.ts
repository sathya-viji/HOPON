/** Maximum number of days in the future a plan can be scheduled. */
export const MAX_PLAN_LOOKAHEAD_DAYS = 14;

/** Maximum plan start time offset in milliseconds (14 days). */
export const MAX_PLAN_LOOKAHEAD_MS = MAX_PLAN_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
