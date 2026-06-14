/**
 * Like on a Recap or a Story.
 *
 * targetType distinguishes what was liked so a single likes table can serve
 * both surfaces. The (userId, targetType, targetId) triple must be unique —
 * the backend should enforce this to prevent double-liking.
 */
export type LikeTarget = 'recap' | 'story';

export interface Like {
  id: string;
  userId: string;
  targetType: LikeTarget;
  targetId: string;
  createdAt: string;
}
