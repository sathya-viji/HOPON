/**
 * Storage helpers — resolve bucket object paths to URLs the UI can render, and
 * upload locally-picked images to a bucket.
 *
 * The backend stores only object *paths* (e.g. avatars.avatar_path,
 * recaps.image_paths[], stories.image_path) — never full URLs. The url helpers
 * turn a path into a public URL so <Avatar uri> / <Image> can load it. A
 * null/empty path returns undefined so callers fall through to a placeholder.
 *
 * Buckets (avatars / recaps / stories) are all PUBLIC, so getPublicUrl is the
 * correct resolver for every one.
 */
import { supabase } from './client';

export type Bucket = 'avatars' | 'recaps' | 'stories';

function publicUrl(bucket: Bucket, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Public URL for an avatar object path, or undefined when there's no avatar. */
export function avatarUrl(path: string | null | undefined): string | undefined {
  return publicUrl('avatars', path);
}

/** Public URL for a recap image object path. */
export function recapImageUrl(path: string | null | undefined): string | undefined {
  return publicUrl('recaps', path);
}

/** Public URL for a story image object path. */
export function storyImageUrl(path: string | null | undefined): string | undefined {
  return publicUrl('stories', path);
}

/** Map an array of recap image paths → renderable URLs (drops any that fail to resolve). */
export function recapImageUrls(paths: string[] | null | undefined): string[] {
  return (paths ?? []).map((p) => recapImageUrl(p)).filter((u): u is string => !!u);
}

/** image/* content-type from a file URI's extension (buckets accept jpeg/png/webp). */
function contentTypeFor(uri: string): { contentType: string; ext: string } {
  const ext = (uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  if (ext === 'png') return { contentType: 'image/png', ext: 'png' };
  if (ext === 'webp') return { contentType: 'image/webp', ext: 'webp' };
  return { contentType: 'image/jpeg', ext: 'jpg' };
}

/**
 * Upload a locally-picked image (an ImagePicker asset URI) to a bucket and
 * return the stored object PATH (what the backend RPCs expect, never a URL).
 *
 * RN-compatible: we fetch the local file URI and pass the raw **ArrayBuffer**
 * (not a Blob) to supabase-js. RN Blobs returned by fetch don't expose their
 * bytes the way supabase-storage-js expects, so a Blob upload silently sends an
 * empty/invalid body — handing over the ArrayBuffer + an explicit contentType
 * is the reliable path (no expo-file-system / base64 dependency needed).
 *
 * Path layout is `${uid}/${timestamp}-${rand}.${ext}` so the own-folder storage
 * RLS (migration 0014t) is satisfied.
 *
 * Throws 'not_authenticated' if there is no session, or the underlying storage
 * error on failure.
 */
export async function uploadImage(bucket: Bucket, localUri: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error('not_authenticated');

  const { contentType, ext } = contentTypeFor(localUri);
  const resp = await fetch(localUri);
  const body = await resp.arrayBuffer();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Upload several images in parallel, returning their object paths in order. */
export async function uploadImages(bucket: Bucket, localUris: string[]): Promise<string[]> {
  return Promise.all(localUris.map((u) => uploadImage(bucket, u)));
}
