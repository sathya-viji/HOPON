/**
 * Maps backend error codes to user-facing messages.
 *
 * RPCs raise `raise exception '<code>' using errcode='P0001'`. PostgREST surfaces
 * the code as the PostgrestError `message`. This module turns that code into copy
 * the UI can toast, so screens never hand-write backend error strings.
 */
export type ApiErrorCode =
  | 'not_authenticated'
  | 'account_suspended'
  | 'underage'
  | 'invalid_handle'
  | 'handle_taken'
  | 'gender_mismatch'
  | 'plan_full'
  | 'plan_closed'
  | 'plan_not_found'
  | 'host_cannot_join_own_plan'
  | 'not_host'
  | 'not_member'
  | 'request_not_found'
  | 'rate_limited'
  | 'too_many_active_plans'
  | 'starts_in_past'
  | 'starts_too_far'
  | 'chat_closed'
  | 'chat_archived'
  | 'empty_message'
  | 'message_not_found'
  | 'endorsement_window_closed'
  | 'giver_not_present'
  | 'receiver_not_present'
  | 'not_present'
  | 'host_cannot_vote'
  | 'vote_window_closed'
  | 'blocked'
  | 'cannot_follow'
  | 'cannot_follow_self'
  | 'cannot_block_self'
  | 'invalid_image_count'
  | 'too_many_recaps'
  | 'plan_not_started'
  | 'recap_not_found'
  | 'invalid_platform';

const MESSAGES: Record<ApiErrorCode, string> = {
  not_authenticated: 'Please sign in again.',
  account_suspended: 'Your account is suspended.',
  underage: 'You must be 18 or older to use hopon.',
  invalid_handle: 'That username isn’t valid.',
  handle_taken: 'That username is already taken.',
  gender_mismatch: 'This plan is limited to a different group.',
  plan_full: 'This plan is full.',
  plan_closed: 'This plan is no longer open.',
  plan_not_found: 'This plan isn’t available.',
  host_cannot_join_own_plan: 'You’re the host of this plan.',
  not_host: 'Only the host can do that.',
  not_member: 'Join the plan to do that.',
  request_not_found: 'That request is no longer pending.',
  rate_limited: 'You’re doing that too often — try again shortly.',
  too_many_active_plans: 'You can have up to 5 active plans at a time.',
  starts_in_past: 'Pick a start time in the future.',
  starts_too_far: 'Plans can be at most 14 days ahead.',
  chat_closed: 'This chat is closed.',
  chat_archived: 'This chat is archived.',
  empty_message: 'Type a message first.',
  message_not_found: 'That message is no longer available.',
  endorsement_window_closed: 'The endorsement window has closed.',
  giver_not_present: 'Only attendees who showed up can endorse.',
  receiver_not_present: 'You can only endorse attendees who showed up.',
  not_present: 'Only attendees who showed up can do that.',
  host_cannot_vote: 'You can’t vote on your own attendance.',
  vote_window_closed: 'The reporting window has closed.',
  blocked: 'This isn’t available.',
  cannot_follow: 'This account can’t be followed.',
  cannot_follow_self: 'You can’t follow yourself.',
  cannot_block_self: 'You can’t block yourself.',
  invalid_image_count: 'Add between 1 and 5 photos.',
  too_many_recaps: 'You’ve already posted recaps for this plan.',
  plan_not_started: 'You can post a recap once the plan has started.',
  recap_not_found: 'This recap isn’t available.',
  invalid_platform: 'Unsupported device.',
};

/** Extract a known code from a thrown Supabase/PostgREST error, if present. */
export function errorCode(err: unknown): ApiErrorCode | null {
  const msg =
    (err as { message?: string })?.message ??
    (typeof err === 'string' ? err : '');
  const trimmed = msg.trim() as ApiErrorCode;
  return trimmed in MESSAGES ? trimmed : null;
}

/** User-facing message for any thrown error (falls back to a generic line). */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const code = errorCode(err);
  return code ? MESSAGES[code] : fallback;
}
