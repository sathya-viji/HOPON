/**
 * contacts-match — Phase 1 Edge Function (execution doc Part 5)
 *
 * POST { hashes: string[] }   — SHA-256 hex of E.164 numbers WITH leading '+',
 *                               hashed CLIENT-SIDE (D10: raw numbers never sent).
 *
 * Responsibilities (frozen):
 *  1. Authenticate the caller (user JWT required).
 *  2. Store the caller's contact hashes (replace strategy: full re-sync).
 *  3. Match against existing users via match_contact_hashes RPC.
 *  4. Return matched users_public rows.
 *
 * contact_joined notifications fire from complete_signup (inverse match at
 * signup time), not here — matching an existing user is not a "joined" event.
 */
import { serviceClient, userClient, json, errorResponse } from '../_shared/client.ts';

const MAX_HASHES = 5000;
const HASH_RE = /^[0-9a-f]{64}$/;
const INSERT_CHUNK = 500;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'POST only', 405);
  }

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const supabaseUser = userClient(req);
  const { data: userData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !userData?.user) {
    return errorResponse('not_authenticated', 'Valid user JWT required', 401);
  }
  const uid = userData.user.id;

  // ── 2. Validate payload ───────────────────────────────────────────────────
  let body: { hashes?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Body must be JSON', 400);
  }

  const raw = body.hashes;
  if (!Array.isArray(raw) || raw.length === 0) {
    return errorResponse('invalid_payload', '`hashes` must be a non-empty array', 400);
  }
  if (raw.length > MAX_HASHES) {
    return errorResponse('too_many_hashes', `Max ${MAX_HASHES} hashes per sync`, 400);
  }

  const hashes = [...new Set(raw.map((h) => String(h).toLowerCase()))];
  if (!hashes.every((h) => HASH_RE.test(h))) {
    return errorResponse('invalid_hash', 'Every hash must be 64-char lowercase hex', 400);
  }

  const service = serviceClient();

  // ── 3. Replace the caller's stored contact hashes ─────────────────────────
  const { error: deleteError } = await service
    .from('contact_hashes')
    .delete()
    .eq('owner_id', uid);
  if (deleteError) {
    console.error('contact_hashes delete failed', deleteError);
    return errorResponse('sync_failed', 'Could not refresh contact hashes', 500);
  }

  for (let i = 0; i < hashes.length; i += INSERT_CHUNK) {
    const chunk = hashes.slice(i, i + INSERT_CHUNK).map((phone_hash) => ({
      owner_id: uid,
      phone_hash,
    }));
    const { error: insertError } = await service.from('contact_hashes').insert(chunk);
    if (insertError) {
      console.error('contact_hashes insert failed', insertError);
      return errorResponse('sync_failed', 'Could not store contact hashes', 500);
    }
  }

  // ── 4. Match against existing users (service-role-only RPC) ──────────────
  const { data: matches, error: matchError } = await service.rpc('match_contact_hashes', {
    p_owner: uid,
    p_hashes: hashes,
  });
  if (matchError) {
    console.error('match_contact_hashes failed', matchError);
    return errorResponse('match_failed', 'Could not match contacts', 500);
  }

  return json({ matches: matches ?? [], synced_count: hashes.length });
});
