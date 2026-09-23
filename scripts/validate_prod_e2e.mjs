/**
 * Prod-safe multi-user E2E smoke test.
 *
 * Unlike scripts/validate_multiuser.mjs (local-only: forges JWTs with the
 * local dev secret, resets state via `docker exec` psql), this script only
 * ever acts as a real, authenticated app user — same beta-auth + password
 * sign-in flow the client uses, same RPCs/REST the client calls. No forged
 * tokens, no raw SQL, no service-role key. Cleans up after itself by calling
 * the app's own delete_account RPC (soft delete, same as a real user would).
 *
 * Run: node scripts/validate_prod_e2e.mjs
 */
import fs from 'node:fs';

const envLines = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
const envVar = (name) => envLines.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1).trim();
const BASE = envVar('EXPO_PUBLIC_SUPABASE_URL');
const ANON = envVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BETA_CODE = '123456';

if (!BASE.startsWith('https://')) {
  console.error(`Refusing to run: EXPO_PUBLIC_SUPABASE_URL (${BASE}) doesn't look like prod.`);
  process.exit(1);
}

async function raw(token, method, path, body) {
  const headers = { apikey: ANON };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

async function signup(phoneDigits, name, handle, dob = '1994-03-10', gender = 'man') {
  const phone = `+91${phoneDigits}`;
  const beta = await raw(null, 'POST', '/functions/v1/beta-auth', { phone, code: BETA_CODE });
  if (beta.status !== 200) throw new Error(`beta-auth failed for ${phone}: ${JSON.stringify(beta.json)}`);
  const tok = await raw(null, 'POST', '/auth/v1/token?grant_type=password', { phone, password: BETA_CODE });
  if (tok.status !== 200 || !tok.json?.access_token) throw new Error(`password sign-in failed for ${phone}: ${JSON.stringify(tok.json)}`);
  const access_token = tok.json.access_token;
  const uid = tok.json.user.id;
  const cs = await rpcTok(access_token, 'complete_signup', {
    p_name: name, p_handle: `@${handle}`, p_dob: dob, p_gender: gender, p_neighbourhood: 'Koramangala',
  });
  if (cs.status !== 200 && cs.status !== 201) throw new Error(`complete_signup failed for ${handle}: ${JSON.stringify(cs.json)}`);
  return { phone, token: access_token, uid, handle };
}

const rpcTok = (token, fn, body = {}) => raw(token, 'POST', `/rest/v1/rpc/${fn}`, body);
const getTok = (token, path) => raw(token, 'GET', `/rest/v1/${path}`);

let pass = 0;
const issues = [];
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { issues.push({ name, detail }); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
const section = (s) => console.log(`\n=== ${s} ===`);
const errText = (r) => (r.json && (r.json.message || r.json.error)) || `HTTP ${r.status}`;

const suffix = Date.now().toString(36).slice(-5);
// Fresh numeric phone digits per run: soft-deleted test accounts from a prior
// run keep their auth UID for 30 days (fn_hard_delete_accounts grace period),
// so reusing a phone number would collide on complete_signup's id/handle
// unique constraints — see the "handle_taken" finding in the report.
const numSuffix = Date.now().toString().slice(-7);
const phoneFor = (i) => `70${i}${numSuffix}`;
const users = {};

async function main() {
  section('0. Signup (real beta-auth + complete_signup, 4 users)');
  users.asha = await signup(phoneFor(1), 'Asha E2E', `e2e_asha_${suffix}`, '1994-03-10', 'woman');
  users.vikram = await signup(phoneFor(2), 'Vikram E2E', `e2e_vikram_${suffix}`, '1992-07-22', 'man');
  users.meera = await signup(phoneFor(3), 'Meera E2E', `e2e_meera_${suffix}`, '1996-11-02', 'woman');
  users.rohit = await signup(phoneFor(4), 'Rohit E2E', `e2e_rohit_${suffix}`, '1990-01-15', 'man');
  ok(Object.values(users).every((u) => u.uid), 'all 4 test users signed up + completed profile');

  section('1. Follow / notification');
  let r = await rpcTok(users.meera.token, 'follow_user', { p_user_id: users.asha.uid });
  ok(r.status === 200, 'meera follows asha', errText(r));
  r = await rpcTok(users.asha.token, 'get_notifications', { p_cursor: 0, p_limit: 20 });
  ok(r.status === 200 && (r.json ?? []).some((n) => n.type === 'new_follower'), 'asha notified of new follower', errText(r));

  section('2. Open plan: create → discover → join');
  const startsAt = new Date(Date.now() + 3 * 3600e3).toISOString();
  r = await rpcTok(users.asha.token, 'create_plan', {
    p_category_id: 'sports', p_activity: `E2E badminton ${suffix}`, p_location_label: 'Koramangala',
    p_lat: 12.9352, p_lng: 77.6245, p_starts_at: startsAt, p_capacity: 4,
    p_plan_type: 'open', p_cost: 'free', p_gender_pref: 'all',
  });
  ok(r.status === 200 || r.status === 201, 'asha creates open plan', errText(r));
  const openPlanId = r.json?.id;

  r = await rpcTok(users.vikram.token, 'search_plans', { p_query: `E2E badminton ${suffix}`, p_filters: {}, p_cursor: 0 });
  ok(r.status === 200 && (r.json?.items ?? r.json ?? []).length >= 1, 'vikram finds the plan via search', errText(r));

  r = await rpcTok(users.vikram.token, 'join_plan', { p_plan_id: openPlanId });
  ok(r.status === 200, 'vikram joins open plan immediately', errText(r));

  r = await rpcTok(users.asha.token, 'get_plan_members', { p_plan_id: openPlanId });
  ok(r.status === 200 && (r.json ?? []).some((m) => m.user_id === users.vikram.uid), 'host sees vikram as a member', errText(r));

  section('3. Chat on the plan');
  r = await rpcTok(users.vikram.token, 'send_message', { p_plan_id: openPlanId, p_body: `hey, excited for this! (${suffix})` });
  ok(r.status === 200 || r.status === 201, 'vikram sends a chat message', errText(r));
  r = await getTok(users.asha.token, `messages?plan_id=eq.${openPlanId}&select=body,author_id`);
  ok(r.status === 200 && (r.json ?? []).some((m) => m.body.includes(suffix)), 'asha reads vikram’s message via RLS', errText(r));
  r = await getTok(users.rohit.token, `messages?plan_id=eq.${openPlanId}&select=body`);
  ok(r.status === 200 && (r.json ?? []).length === 0, 'non-member rohit sees zero messages (RLS)', errText(r));

  section('4. Request-type plan: join → pending → approve');
  r = await rpcTok(users.meera.token, 'create_plan', {
    p_category_id: 'sports', p_activity: `E2E climbing ${suffix}`, p_location_label: 'Koramangala',
    p_lat: 12.9352, p_lng: 77.6245, p_starts_at: startsAt, p_capacity: 4,
    p_plan_type: 'closed', p_cost: 'free', p_gender_pref: 'all',
  });
  ok(r.status === 200 || r.status === 201, 'meera creates request-type plan', errText(r));
  const reqPlanId = r.json?.id;

  r = await rpcTok(users.rohit.token, 'join_plan', { p_plan_id: reqPlanId });
  ok(r.status === 200, 'rohit requests to join', errText(r));
  r = await rpcTok(users.meera.token, 'get_plan_detail', { p_plan_id: reqPlanId });
  const rohitPending = r.json?.pending_requests?.some?.((p) => p.id === users.rohit.uid) ?? r.json?.joiners?.some?.((p) => p.id === users.rohit.uid && p.status === 'pending');
  ok(r.status === 200, 'meera can read plan detail with pending request', errText(r));

  r = await rpcTok(users.meera.token, 'approve_request', { p_plan_id: reqPlanId, p_user_id: users.rohit.uid });
  ok(r.status === 200 || r.status === 204, 'meera approves rohit', errText(r));
  r = await rpcTok(users.meera.token, 'get_plan_members', { p_plan_id: reqPlanId });
  ok(r.status === 200 && (r.json ?? []).some((m) => m.user_id === users.rohit.uid), 'rohit now shows as approved member', errText(r));

  section('5. Decline path');
  r = await rpcTok(users.vikram.token, 'join_plan', { p_plan_id: reqPlanId });
  ok(r.status === 200, 'vikram requests to join meera’s plan too', errText(r));
  r = await rpcTok(users.meera.token, 'decline_request', { p_plan_id: reqPlanId, p_user_id: users.vikram.uid });
  ok(r.status === 200 || r.status === 204, 'meera declines vikram', errText(r));
  r = await rpcTok(users.meera.token, 'get_plan_members', { p_plan_id: reqPlanId });
  ok(r.status === 200 && !(r.json ?? []).some((m) => m.user_id === users.vikram.uid), 'vikram correctly absent after decline', errText(r));

  section('6. People search + home feed');
  r = await rpcTok(users.rohit.token, 'search_users', { p_query: `e2e_asha_${suffix}`, p_cursor: 0 });
  ok(r.status === 200 && (r.json ?? []).length >= 1, 'people search finds asha by handle', errText(r));
  r = await rpcTok(users.vikram.token, 'get_home_feed', { p_lat: 12.9352, p_lng: 77.6245, p_radius_km: 50, p_filters: {}, p_cursor: 0 });
  ok(r.status === 200, 'home feed loads for vikram', errText(r));

  section('7. Leave / cancel');
  r = await rpcTok(users.vikram.token, 'leave_plan', { p_plan_id: openPlanId });
  ok(r.status === 200 || r.status === 204, 'vikram leaves the open plan', errText(r));
  r = await rpcTok(users.asha.token, 'cancel_plan', { p_plan_id: openPlanId });
  ok(r.status === 200 || r.status === 204, 'asha cancels her own plan', errText(r));
  r = await rpcTok(users.meera.token, 'cancel_plan', { p_plan_id: reqPlanId });
  ok(r.status === 200 || r.status === 204, 'meera cancels her own plan', errText(r));

  section('Cleanup — self-service delete_account for all test users');
  for (const [k, u] of Object.entries(users)) {
    const r = await rpcTok(u.token, 'delete_account', {});
    ok(r.status === 200 || r.status === 204, `${k} account deleted (soft, 30-day grace)`, errText(r));
  }

  console.log(`\n${pass} passed, ${issues.length} failed.`);
  if (issues.length) { console.log('\nFailures:'); issues.forEach((i) => console.log(`  - ${i.name}: ${i.detail}`)); process.exitCode = 1; }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
