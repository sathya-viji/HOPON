/**
 * beta-auth — BETA-ONLY passwordless backdoor (replaces Twilio OTP for testing).
 *
 * ⚠️ SECURITY: this lets ANY phone number sign in with a single shared code
 * (BETA_AUTH_CODE). It is a deliberate backdoor for closed beta only. REMOVE
 * before any public launch: delete this function, unset BETA_AUTH_CODE, and set
 * EXPO_PUBLIC_BETA_AUTH=false (see src/api/auth.ts).
 *
 * Flow: client POSTs { phone (E.164), code }. We validate the code, then ensure
 * an auth user exists for that phone with password = the code (create or reset),
 * phone pre-confirmed. The client then calls signInWithPassword({ phone, code })
 * to obtain a normal session. Works identically for new signups and returning
 * logins. Deployed with --no-verify-jwt (callable before the user has a session).
 */
import { serviceClient, json } from '../_shared/client.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let phone: string | undefined;
  let code: string | undefined;
  try {
    const b = await req.json();
    phone = b?.phone;
    code = b?.code;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const BETA = Deno.env.get('BETA_AUTH_CODE');
  if (!BETA) return json({ error: 'beta_not_configured' }, 500);
  if (!phone || !code) return json({ error: 'missing_phone_or_code' }, 400);
  if (code !== BETA) return json({ error: 'invalid_code' }, 401);

  const digits = phone.replace(/\D/g, '');   // GoTrue stores phone without '+'
  if (digits.length < 8) return json({ error: 'invalid_phone' }, 400);
  const e164 = '+' + digits;

  const db = serviceClient();
  try {
    // Find an existing user by phone (small beta population → single page).
    const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) return json({ error: 'lookup_failed', detail: listErr.message }, 500);
    const existing = list?.users?.find((u) => (u.phone ?? '') === digits);

    if (existing) {
      const { error } = await db.auth.admin.updateUserById(existing.id, { password: BETA, phone_confirm: true });
      if (error) return json({ error: 'update_failed', detail: error.message }, 500);
      return json({ ok: true, created: false }, 200);
    }

    const { error } = await db.auth.admin.createUser({ phone: e164, password: BETA, phone_confirm: true });
    if (error) return json({ error: 'create_failed', detail: error.message }, 500);
    return json({ ok: true, created: true }, 200);
  } catch (e) {
    return json({ error: 'beta_auth_error', detail: String(e) }, 500);
  }
});
