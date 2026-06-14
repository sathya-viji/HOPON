/**
 * Block and Report entities.
 *
 * Block is a unidirectional relationship: blockerId never sees blockedId's
 * content, and blockedId cannot see blockerId's plans or profile.
 *
 * Report is submitted by a user against another user or a plan. The backend
 * routes it to a moderation queue. status is managed server-side only —
 * the client never reads it back, it just submits.
 */
export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type ReportTargetType = 'user' | 'plan';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'no_show'
  | 'safety_concern'
  | 'other';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  notes?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
}
