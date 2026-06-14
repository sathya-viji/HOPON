export interface Message {
  id: string;
  planId: string;
  authorId: string;
  authorName: string;
  authorAvatarUri?: string;
  isHost: boolean;
  body: string;
  createdAt: string;
}

export interface Chat {
  planId: string;
  isActive: boolean;
  messages: Message[];
}
