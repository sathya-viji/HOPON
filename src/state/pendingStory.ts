/**
 * Pending-story store — bridges the moderation gap on the author's own bubble.
 *
 * A freshly posted story is `moderation='pending'` and is excluded from
 * get_stories_feed (even for the author), so without this the author sees
 * nothing after posting until a moderator approves it (seconds in prod, never in
 * local dev). We remember the just-posted story's local image URI here so the
 * Recaps screen can render an animated "in review" ring immediately, then clear
 * it once the approved story shows up in the feed (or after a max age, in case
 * it was rejected). Session-scoped (in-memory) — that's fine, it only needs to
 * cover the window between posting and the next feed refresh.
 */
import { useSyncExternalStore } from 'react';

export interface PendingStory {
  imageUri: string;
  postedAt: number;
}

/** How long to keep showing the in-review ring if the story never goes live
 *  (e.g. it was rejected, or local dev has no moderator). */
export const PENDING_STORY_MAX_AGE_MS = 30 * 60 * 1000;

let current: PendingStory | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setPendingStory(imageUri: string): void {
  current = { imageUri, postedAt: Date.now() };
  emit();
}

export function clearPendingStory(): void {
  if (current === null) return;
  current = null;
  emit();
}

function getSnapshot(): PendingStory | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive access to the current pending story (or null). */
export function usePendingStory(): PendingStory | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
