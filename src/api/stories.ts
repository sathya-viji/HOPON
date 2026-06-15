/**
 * Stories API — Wave 5 (Phase 5 backend).
 *
 * Stories are single-image, 24h-expiring posts, grouped by author in the feed.
 * Like recaps they are moderation-gated (a fresh story is `pending` until
 * approved). There is NO like/comment backend for stories — only view tracking
 * (record_story_view) and report (submit_report with target_type 'story').
 *
 * Contracts (migration 0014g):
 *   get_stories_feed() → [{author, stories:[{id,image_path,caption,plan_label,
 *     expires_at,seen}]}]   (approved + unexpired + author visible + not blocked)
 *   post_story(image_path, caption?, plan_id?, plan_label?) → stories row (pending)
 *   record_story_view(id) — raises story_not_found; idempotent
 *   delete_story(id)
 */
import { supabase } from './client';
import { storyImageUrl } from './storage';
import { mapSocialAuthor, type PublicUserEmbed } from './social';
import type { Story, StoryGroup } from '@/types';

interface StoryRow {
  id: string;
  image_path: string;
  caption: string | null;
  plan_label: string | null;
  expires_at: string;
  seen: boolean;
}

interface StoryGroupRow {
  author: PublicUserEmbed | null;
  stories: StoryRow[];
}

function mapStory(authorId: string, row: StoryRow): Story {
  return {
    id: row.id,
    authorId,
    imageUri: storyImageUrl(row.image_path) ?? '',
    caption: row.caption ?? undefined,
    planLabel: row.plan_label ?? undefined,
    // Stories carry expiry, not a created_at, in the feed; derive a display
    // timestamp 24h before expiry so timeAgo() stays meaningful.
    createdAt: new Date(new Date(row.expires_at).getTime() - 24 * 3600_000).toISOString(),
    isSeen: row.seen,
    expiresAt: row.expires_at,
  };
}

/** Active stories grouped by author, newest group first. */
export async function getStoriesFeed(): Promise<StoryGroup[]> {
  const { data, error } = await supabase.rpc('get_stories_feed');
  if (error) throw error;
  return ((data ?? []) as StoryGroupRow[])
    .map((g): StoryGroup | null => {
      const author = mapSocialAuthor(g.author);
      if (!author) return null; // author not visible to viewer — skip the group
      const stories = (g.stories ?? []).map((s) => mapStory(author.id, s));
      return { author, stories, allSeen: stories.every((s) => s.isSeen) };
    })
    .filter((g): g is StoryGroup => g !== null);
}

/** Create a story (image object path already uploaded). Returns the new id. */
export async function postStory(
  imagePath: string,
  caption?: string,
  planId?: string | null,
  planLabel?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('post_story', {
    p_image_path: imagePath,
    p_caption: caption?.trim() ? caption.trim() : null,
    p_plan_id: planId ?? null,
    p_plan_label: planLabel ?? null,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function recordStoryView(storyId: string): Promise<void> {
  const { error } = await supabase.rpc('record_story_view', { p_story_id: storyId });
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_story', { p_story_id: storyId });
  if (error) throw error;
}
