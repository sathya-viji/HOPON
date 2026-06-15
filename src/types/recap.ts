/** Lightweight author summary embedded in social view-models. */
export interface SocialAuthor {
  id: string;
  name: string;
  handle: string;
  avatarUri?: string;
}

export interface Recap {
  id: string;
  planId: string;
  authorId: string;
  /** First image — what list cards render. */
  imageUri: string;
  /** All images (1–5) for the detail carousel. Falls back to [imageUri]. */
  imageUris?: string[];
  caption?: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  /** Whether the signed-in viewer has liked this recap (from the backend). */
  likedByMe?: boolean;
  /** Embedded author (from get_recaps_feed / get_recap_detail). */
  author?: SocialAuthor;
  isSeen?: boolean;
}
