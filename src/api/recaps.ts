/**
 * Recaps API — Wave 5 (Phase 5 backend).
 *
 * Recaps are photo posts tied to a plan the author attended. All mutations are
 * RPC-only and moderation-gated: a freshly posted recap is `pending` and only
 * becomes visible to others once a moderator approves it (the realtime/feed
 * flip). Reads go through SECURITY DEFINER RPCs that embed the author
 * (users_public) and the viewer's like state.
 *
 * Contracts (migration 0014g):
 *   get_recaps_feed(cursor,limit) → [{id,plan_id,image_paths,caption,like_count,
 *     comment_count,created_at,author,liked_by_me}]   (approved + not blocked)
 *   get_recap_detail(id) → {...,comments:[{id,body,created_at,is_deleted,author}]}
 *     raises recap_not_found if not approved (unless author) or blocked
 *   post_recap(plan_id, image_paths[1..5], caption?) → recaps row (moderation pending)
 *   like_recap / unlike_recap / comment_recap / delete_comment / delete_recap
 */
import { supabase } from './client';
import { recapImageUrls } from './storage';
import { mapSocialAuthor, type PublicUserEmbed } from './social';
import type { Recap, Comment } from '@/types';

interface RecapFeedRow {
  id: string;
  plan_id: string;
  image_paths: string[] | null;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: PublicUserEmbed | null;
  liked_by_me: boolean;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  is_deleted: boolean;
  author: PublicUserEmbed | null;
}

interface RecapDetailRow extends RecapFeedRow {
  comments: CommentRow[];
}

function mapRecap(row: RecapFeedRow): Recap {
  const urls = recapImageUrls(row.image_paths);
  const author = mapSocialAuthor(row.author);
  return {
    id: row.id,
    planId: row.plan_id,
    authorId: row.author?.id ?? '',
    imageUri: urls[0] ?? '',
    imageUris: urls,
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    likedByMe: row.liked_by_me,
    author,
  };
}

function mapComment(recapId: string, row: CommentRow): Comment {
  const author = mapSocialAuthor(row.author);
  return {
    id: row.id,
    recapId,
    authorId: row.author?.id ?? '',
    authorName: author?.name ?? (row.is_deleted ? '' : 'Member'),
    authorAvatarUri: author?.avatarUri,
    body: row.body,
    parentId: null,
    createdAt: row.created_at,
    isDeleted: row.is_deleted,
  };
}

export interface RecapDetail {
  recap: Recap;
  comments: Comment[];
}

/** Approved recaps feed (newest first), with the viewer's like state embedded. */
export async function getRecapsFeed(cursor = 0, limit = 20): Promise<Recap[]> {
  const { data, error } = await supabase.rpc('get_recaps_feed', { p_cursor: cursor, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as RecapFeedRow[]).map(mapRecap);
}

/** Full recap + comments. Throws `recap_not_found` if hidden/rejected/blocked. */
export async function getRecapDetail(recapId: string): Promise<RecapDetail> {
  const { data, error } = await supabase.rpc('get_recap_detail', { p_recap_id: recapId });
  if (error) throw error;
  const row = data as RecapDetailRow;
  return {
    recap: mapRecap(row),
    comments: (row.comments ?? []).map((c) => mapComment(row.id, c)),
  };
}

/** Create a recap (image object paths already uploaded). Returns the new id. */
export async function postRecap(planId: string, imagePaths: string[], caption?: string): Promise<string> {
  const { data, error } = await supabase.rpc('post_recap', {
    p_plan_id: planId,
    p_image_paths: imagePaths,
    p_caption: caption?.trim() ? caption.trim() : null,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function likeRecap(recapId: string): Promise<void> {
  const { error } = await supabase.rpc('like_recap', { p_recap_id: recapId });
  if (error) throw error;
}

export async function unlikeRecap(recapId: string): Promise<void> {
  const { error } = await supabase.rpc('unlike_recap', { p_recap_id: recapId });
  if (error) throw error;
}

/** Add a comment; returns the created comment id. */
export async function commentRecap(recapId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('comment_recap', { p_recap_id: recapId, p_body: body });
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });
  if (error) throw error;
}

export async function deleteRecap(recapId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_recap', { p_recap_id: recapId });
  if (error) throw error;
}

interface RecapTableRow {
  id: string;
  plan_id: string;
  author_id: string;
  image_paths: string[] | null;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
}

/**
 * A user's approved recaps, newest first — for the ProfileOther "Recaps" tab.
 * Read directly through recaps RLS (own rows + approved & not-blocked). The
 * author summary is supplied by the caller (the profile being viewed) so cards
 * can render without re-resolving each author.
 */
export async function getUserRecaps(userId: string, author?: Recap['author']): Promise<Recap[]> {
  const { data, error } = await supabase
    .from('recaps')
    .select('id,plan_id,author_id,image_paths,caption,like_count,comment_count,created_at')
    .eq('author_id', userId)
    .eq('moderation', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RecapTableRow[]).map((r) => {
    const urls = recapImageUrls(r.image_paths);
    return {
      id: r.id,
      planId: r.plan_id,
      authorId: r.author_id,
      imageUri: urls[0] ?? '',
      imageUris: urls,
      caption: r.caption ?? undefined,
      createdAt: r.created_at,
      likeCount: r.like_count,
      commentCount: r.comment_count,
      author,
    };
  });
}
