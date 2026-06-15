/**
 * Shared mapping for the embedded author summaries that the Wave 5 social RPCs
 * return. Every feed/detail RPC embeds the author as a `users_public` row via
 * `to_jsonb(up)`; when the author is followers-only-and-not-followed (or
 * blocked) the embed comes back null, which we surface as `undefined` so the UI
 * can fall back to a placeholder.
 */
import { avatarUrl } from './storage';
import type { SocialAuthor } from '@/types';

/** The subset of a users_public row the social RPCs embed. */
export interface PublicUserEmbed {
  id: string;
  name: string;
  handle: string;
  avatar_path: string | null;
}

export function mapSocialAuthor(row: PublicUserEmbed | null | undefined): SocialAuthor | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    avatarUri: avatarUrl(row.avatar_path),
  };
}
