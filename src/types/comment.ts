/**
 * Comment on a Recap.
 *
 * parentId is null for top-level comments and set to another comment's id
 * for replies. The UI currently shows one level of nesting only.
 */
export interface Comment {
  id: string;
  recapId: string;
  authorId: string;
  authorName: string;
  authorAvatarUri?: string;
  body: string;
  parentId: string | null;
  createdAt: string;
}
