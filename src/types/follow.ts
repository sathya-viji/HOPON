/**
 * Follow relationship between two users.
 *
 * followerId is the user who initiated the follow.
 * followingId is the user being followed.
 * status 'pending' applies when the followed user has profileVisibility='followers'
 * and hasn't accepted yet; 'accepted' is the normal state.
 */
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}
