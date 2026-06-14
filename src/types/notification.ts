export type NotifType =
  | 'new_joiner'
  | 'join_request'
  | 'request_approved'
  | 'request_declined'
  | 'plan_ended'
  | 'new_recap'
  | 'new_follower';

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
