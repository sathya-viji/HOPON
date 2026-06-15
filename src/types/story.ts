import type { SocialAuthor } from './recap';

export interface Story {
  id: string;
  authorId: string;
  imageUri: string;
  caption?: string;
  planLabel?: string;
  createdAt: string;
  isSeen: boolean;
  /** When the story disappears (24h after posting). */
  expiresAt?: string;
}

/**
 * Stories grouped by author, as get_stories_feed returns them. The Recaps
 * screen renders one bubble per group; the viewer pages within a group.
 */
export interface StoryGroup {
  author: SocialAuthor;
  stories: Story[];
  /** True when every story in the group has been seen by the viewer. */
  allSeen: boolean;
}
