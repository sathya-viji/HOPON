// NotifType mirrors the backend `notif_type` enum (41 types, migration 0002).
// The notification copy (`body`) is rendered server-side; the client maps each
// type to an icon (NotifRow) and a navigation target (NotificationsScreen).
export type NotifType =
  // plan (host)
  | 'plan_posted'
  | 'new_joiner'
  | 'join_request'
  | 'joiner_left'
  | 'plan_full'
  | 'plan_starting_soon_host'
  | 'plan_started_host'
  | 'plan_ended_host'
  | 'endorse_reminder'
  | 'recap_reminder'
  | 'plan_cancelled_confirm'
  | 'host_marked_absent'
  | 'new_recap_on_your_plan'
  // plan (joiner)
  | 'request_approved'
  | 'request_declined'
  | 'plan_updated'
  | 'plan_cancelled'
  | 'plan_starting_soon_joiner'
  | 'plan_starting_15'
  | 'plan_ended_joiner'
  | 'marked_noshow'
  // chat
  | 'mention'
  // trust
  | 'endorsement_received'
  | 'attendance_score_improved'
  | 'attendance_score_dropped'
  | 'new_familiar_face'
  // recaps & stories
  | 'recap_liked'
  | 'recap_commented'
  | 'recap_comment_replied'
  | 'new_recap_from_following'
  | 'story_expiring_soon'
  // social
  | 'new_follower'
  | 'follow_request'
  | 'follow_accepted'
  | 'following_posted_plan'
  // system
  | 'welcome'
  | 'profile_incomplete'
  | 'first_plan_nudge'
  | 'contact_joined'
  | 'plan_expired_host'
  | 'plan_expired_joiner';

export interface Notification {
  id: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
  planId?: string;
  userId?: string;
  recapId?: string;
  actorName?: string;
  actorAvatarUri?: string;
  body: string;
  planLabel?: string;
}
