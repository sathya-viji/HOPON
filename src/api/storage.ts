/**
 * Storage helpers — resolve bucket object paths to URLs the UI can render.
 *
 * The backend stores only object *paths* (e.g. avatars.avatar_path,
 * recaps.image_paths[]) — never full URLs. This turns a path into a public URL
 * so <Avatar uri> / <Image> can load it. A null/empty path returns undefined so
 * callers fall through to the initials placeholder.
 */
import { supabase } from './client';

/** Public URL for an avatar object path, or undefined when there's no avatar. */
export function avatarUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
