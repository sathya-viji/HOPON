/**
 * image-moderator — Phase 5 Edge Function (execution doc Part 5 / F2)
 *
 * Invoked after upload to moderate a recap's images or a story's image via
 * Google Vision SafeSearch. POST one of:
 *   { recap_id }   — moderate ALL paths in recaps.image_paths; approve only if
 *                    every image passes, else reject the whole recap.
 *   { story_id }   — moderate the single story image.
 *
 * On pass → calls approve_recap / approve_story (which fire notifications).
 * On fail → reject_recap / reject_story + image_rejected audit + object removal.
 *
 * Local/CI: with no GOOGLE_VISION_KEY, images auto-pass (mirrors push-sender
 * skipping Expo) so the social flow is testable end-to-end without a key.
 */
import { serviceClient, json } from '../_shared/client.ts';

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
const BLOCK = new Set(['LIKELY', 'VERY_LIKELY']);

async function imageFails(publicUrl: string, key: string): Promise<boolean> {
  const res = await fetch(`${VISION_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: publicUrl } },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }],
      }],
    }),
  });
  const j = await res.json().catch(() => ({}));
  const s = j?.responses?.[0]?.safeSearchAnnotation;
  if (!s) return false;
  // Reject on adult or violence at LIKELY+ (frozen thresholds).
  return BLOCK.has(s.adult) || BLOCK.has(s.violence);
}

function publicUrl(bucket: string, path: string): string {
  const base = Deno.env.get('SUPABASE_URL');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: { recap_id?: string; story_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const db = serviceClient();
  const key = Deno.env.get('GOOGLE_VISION_KEY');

  try {
    if (body.recap_id) {
      const { data: recap } = await db.from('recaps')
        .select('id, image_paths, moderation').eq('id', body.recap_id).single();
      if (!recap) return json({ status: 'recap_not_found' }, 200);
      if (recap.moderation !== 'pending') return json({ status: 'already_moderated' }, 200);

      let bad = false;
      if (key) {
        for (const p of recap.image_paths as string[]) {
          if (await imageFails(publicUrl('recaps', p), key)) { bad = true; break; }
        }
      } // no key → auto-pass (local/CI)

      if (bad) {
        await db.rpc('reject_recap', { p_recap_id: recap.id });
        await db.storage.from('recaps').remove(recap.image_paths as string[]);
        await db.from('audit_logs').insert({
          actor_type: 'system', action: 'image_rejected', target_type: 'recap', target_id: recap.id,
          detail: { images: (recap.image_paths as string[]).length },
        });
        return json({ status: 'rejected' }, 200);
      }
      await db.rpc('approve_recap', { p_recap_id: recap.id });
      return json({ status: 'approved', images: (recap.image_paths as string[]).length }, 200);
    }

    if (body.story_id) {
      const { data: story } = await db.from('stories')
        .select('id, image_path, moderation').eq('id', body.story_id).single();
      if (!story) return json({ status: 'story_not_found' }, 200);
      if (story.moderation !== 'pending') return json({ status: 'already_moderated' }, 200);

      const bad = key ? await imageFails(publicUrl('stories', story.image_path), key) : false;
      if (bad) {
        await db.rpc('reject_story', { p_story_id: story.id });
        await db.storage.from('stories').remove([story.image_path]);
        await db.from('audit_logs').insert({
          actor_type: 'system', action: 'image_rejected', target_type: 'story', target_id: story.id, detail: {},
        });
        return json({ status: 'rejected' }, 200);
      }
      await db.rpc('approve_story', { p_story_id: story.id });
      return json({ status: 'approved' }, 200);
    }

    return json({ error: 'missing recap_id or story_id' }, 400);
  } catch (e) {
    console.error('[image-moderator] failure', e);
    return json({ status: 'error', detail: String(e) }, 200);
  }
});
