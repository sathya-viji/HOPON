/**
 * Shared Supabase clients for Edge Functions.
 *
 * serviceClient — bypasses RLS. Use for system writes (notifications,
 *                 audit_logs, moderation). Never expose its results raw
 *                 to the caller without filtering.
 * userClient    — runs as the calling user (forwards their JWT). Use when
 *                 the function acts on the user's behalf so RLS applies.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SUPABASE_URL, SERVICE_ROLE_KEY } from './env.ts';

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Standard JSON response helpers — consistent error contract across functions. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}
