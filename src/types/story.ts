export interface Story {
  id: string;
  authorId: string;
  imageUri: string;
  caption?: string;
  planLabel?: string;
  createdAt: string;
  isSeen: boolean;
}
