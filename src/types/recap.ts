export interface Recap {
  id: string;
  planId: string;
  authorId: string;
  imageUri: string;
  caption?: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isSeen?: boolean;
}
