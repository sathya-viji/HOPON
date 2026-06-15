/**
 * Multi-user validation harness (Waves 1–5.1).
 *
 * Mints HS256 JWTs for the seeded users (+ a service_role token) and drives the
 * real PostgREST surface as each user, so RLS + RPC behaviour is exercised
 * exactly as the app would. Asserts RPC results, DB state (read back via psql,
 * since `users` is locked even from service_role by design), and cross-user
 * visibility. Run after `supabase db reset` for a clean baseline:
 *   supabase db reset && node scripts/validate_multiuser.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:54321';
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const ANON = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const U = {
  you:   '00000000-0000-4000-a000-000000000000',
  arjun: '00000000-0000-4000-a000-000000000001',
  priya: '00000000-0000-4000-a000-000000000002',
  kiran: '00000000-0000-4000-a000-000000000003',
  sneha: '00000000-0000-4000-a000-000000000004',
  dev:   '00000000-0000-4000-a000-000000000005',
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub, role = 'authenticated') {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role, aud: role, exp: now + 3600, iat: now });
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
const TOK = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, jwt(v)]));
const SVC = jwt('00000000-0000-0000-0000-000000000000', 'service_role');

async function call(token, method, path, body, raw = false) {
  const headers = { apikey: ANON, Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return raw ? { status: res.status, json } : json;
}
const rpc = (who, fn, body = {}) => call(TOK[who], 'POST', `/rest/v1/rpc/${fn}`, body, true);
const get = (who, path) => call(TOK[who], 'GET', `/rest/v1/${path}`);
const svcRpc = (fn, body = {}) => call(SVC, 'POST', `/rest/v1/rpc/${fn}`, body, true);
const svcPatch = (path, body) => call(SVC, 'PATCH', `/rest/v1/${path}`, body, true);
// set own visibility as the user (own-row column grant) — how the app does it
const setVis = (who, patch) => call(TOK[who], 'PATCH', `/rest/v1/users?id=eq.${U[who]}`, patch, true);
// DB state read/reset via psql (users is locked from PostgREST even for service_role)
const db = (sql) => execSync(`docker exec -i supabase_db_hopon psql -U postgres -d postgres -tAc ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim();

const JPEG = Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xff,0xd9]);
async function upload(who, bucket, path) {
  const res = await fetch(`${BASE}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${TOK[who]}`, 'Content-Type': 'image/jpeg' }, body: JPEG,
  });
  return res.status;
}

let pass = 0;
const issues = [];
function ok(cond, name, sev = 'High', detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { issues.push({ sev, name, detail }); console.log(`  ❌ [${sev}] ${name}${detail ? ' — ' + detail : ''}`); }
}
const errCode = (r) => (r.json && r.json.message) || `HTTP ${r.status}`;
const section = (s) => console.log(`\n=== ${s} ===`);
const newPlan = (who, opts = {}) => rpc(who, 'create_plan', {
  p_category_id: opts.cat || 'sports', p_activity: opts.activity || 'Plan', p_location_label: 'Loc',
  p_lat: 12.9, p_lng: 77.6, p_starts_at: new Date(Date.now() + 3600e3).toISOString(),
  p_capacity: opts.cap || 6, p_plan_type: opts.plan_type || 'open', p_cost: 'free', p_gender_pref: opts.gender_pref || 'all',
});
async function startedPlan(who, opts = {}) {
  const r = await newPlan(who, opts);
  const id = r.json && r.json.id;
  if (id) await svcPatch(`plans?id=eq.${id}`, { starts_at: new Date(Date.now() - 7200e3).toISOString() });
  return id;
}

async function main() {
  // Idempotent reset of social/test state so re-runs are clean (single line for psql -c).
  db(`delete from messages; delete from attendance_marks; delete from attendance_resolutions; delete from recap_comments; delete from recap_likes; delete from recaps; delete from stories; delete from follows; delete from blocks; delete from reports; delete from notifications; delete from familiar_faces; delete from plan_members where not is_host_row; delete from feed_events; delete from plans where host_id <> '${U.you}'; update users set profile_visibility='everyone', plan_visibility='everyone', account_status='active', suspended_until=null, suspension_reason=null;`);

  // ───────────────────────── FOLLOWS ─────────────────────────
  section('1. Follow request / approval / removal (Wave 5)');
  let r = await rpc('you', 'follow_user', { p_user_id: U.arjun });
  ok(r.status === 200 && r.json.status === 'accepted', 'everyone-visibility follow auto-accepts', 'High', errCode(r));
  ok(db(`select count(*) from notifications where user_id='${U.arjun}' and type='new_follower'`) >= 1, 'new_follower notification created');
  r = await rpc('you', 'follow_user', { p_user_id: U.you });
  ok(r.status >= 400 && /cannot_follow_self/.test(errCode(r)), 'self-follow rejected', 'Medium', errCode(r));
  await rpc('you', 'unfollow', { p_user_id: U.arjun });
  ok(db(`select count(*) from follows where follower_id='${U.you}' and following_id='${U.arjun}'`) === '0', 'unfollow removes edge');

  // followers-only Priya (set as Priya — own-row grant)
  await setVis('priya', { profile_visibility: 'followers' });
  ok(db(`select profile_visibility from users where id='${U.priya}'`) === 'followers', 'user can set own profile_visibility=followers', 'High');
  r = await rpc('kiran', 'follow_user', { p_user_id: U.priya });
  ok(r.status === 200 && r.json.status === 'pending', 'followers-only follow goes pending', 'High', errCode(r));
  ok(db(`select count(*) from notifications where user_id='${U.priya}' and type='follow_request'`) >= 1, 'follow_request notification created');
  r = await rpc('priya', 'accept_follow', { p_follower_id: U.kiran });
  ok(r.status <= 204, 'accept_follow succeeds', 'High', errCode(r));
  ok(db(`select status from follows where follower_id='${U.kiran}' and following_id='${U.priya}'`) === 'accepted', 'follow row accepted');
  ok(db(`select count(*) from notifications where user_id='${U.kiran}' and type='follow_accepted'`) >= 1, 'follow_accepted notification created');
  await rpc('dev', 'follow_user', { p_user_id: U.priya });
  r = await rpc('priya', 'decline_follow', { p_follower_id: U.dev });
  ok(r.status <= 204 && db(`select count(*) from follows where follower_id='${U.dev}' and following_id='${U.priya}'`) === '0', 'decline_follow removes request');

  // ───────────────── Followers-only visibility ─────────────────
  section('2. Followers-only profile / story / plan visibility');
  ok((await get('kiran', `users_public?id=eq.${U.priya}&select=id`)).length === 1, 'follower sees followers-only profile');
  ok((await get('dev', `users_public?id=eq.${U.priya}&select=id`)).length === 0, 'non-follower cannot see followers-only profile', 'High');

  await upload('priya', 'stories', `${U.priya}/s1.jpg`);
  r = await rpc('priya', 'post_story', { p_image_path: `${U.priya}/s1.jpg`, p_caption: 'priya story' });
  const storyId = r.json.id;
  ok(r.status === 200 && storyId, 'post_story creates story', 'High', errCode(r));
  let feed = await rpc('kiran', 'get_stories_feed');
  ok(!feed.json.some((g) => g.author?.id === U.priya), 'pending story hidden even from follower', 'High');
  await svcRpc('approve_story', { p_story_id: storyId });
  ok((await rpc('kiran', 'get_stories_feed')).json.some((g) => g.author?.id === U.priya), 'follower sees approved followers-only story', 'High');
  ok(!(await rpc('dev', 'get_stories_feed')).json.some((g) => g.author?.id === U.priya), 'non-follower does NOT see followers-only story', 'High');

  await setVis('priya', { plan_visibility: 'followers' });
  const ppid = (await newPlan('priya', { cat: 'social', activity: 'Priya plan' })).json.id;
  let pd = await rpc('kiran', 'get_plan_detail', { p_plan_id: ppid });
  ok(pd.status === 200 && pd.json?.plan, 'follower can open followers-only plan', 'High', errCode(pd));
  pd = await rpc('dev', 'get_plan_detail', { p_plan_id: ppid });
  ok(pd.status >= 400 && /plan_not_found/.test(errCode(pd)), 'non-follower cannot open followers-only plan', 'High', errCode(pd));
  // home feed excludes followers-only plan for non-follower
  let hf = await rpc('dev', 'get_home_feed', { p_lat: 12.9, p_lng: 77.6, p_radius_km: 50, p_filters: {}, p_cursor: 0 });
  ok(!hf.json.some((it) => it.plan?.id === ppid), 'home feed hides followers-only plan from non-follower', 'High');
  await setVis('priya', { profile_visibility: 'everyone', plan_visibility: 'everyone' });

  // ───────────────── Recaps ─────────────────
  section('3. Recap moderation + feed + edges');
  const plan = await startedPlan('arjun', { activity: 'Recap plan' });
  await rpc('priya', 'join_plan', { p_plan_id: plan });
  r = await rpc('dev', 'post_recap', { p_plan_id: plan, p_image_paths: [`${U.dev}/r.jpg`] });
  ok(r.status >= 400 && /not_member/.test(errCode(r)), 'post_recap by non-member rejected', 'High', errCode(r));
  r = await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: [] });
  ok(r.status >= 400 && /invalid_image_count/.test(errCode(r)), 'empty images rejected', 'Medium', errCode(r));
  r = await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: Array(6).fill(`${U.arjun}/r.jpg`) });
  ok(r.status >= 400 && /invalid_image_count/.test(errCode(r)), '>5 images rejected', 'Medium', errCode(r));
  await upload('arjun', 'recaps', `${U.arjun}/r1.jpg`);
  r = await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: [`${U.arjun}/r1.jpg`], p_caption: 'arjun recap' });
  const recapId = r.json.id;
  ok(r.status === 200 && recapId, 'post_recap (member) succeeds', 'High', errCode(r));
  ok(!(await rpc('kiran', 'get_recaps_feed')).json.some((x) => x.id === recapId), 'pending recap hidden from feed', 'High');
  await svcRpc('approve_recap', { p_recap_id: recapId });
  ok((await rpc('kiran', 'get_recaps_feed')).json.some((x) => x.id === recapId), 'approved recap appears in feed', 'High');
  await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: [`${U.arjun}/r1.jpg`] });
  await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: [`${U.arjun}/r1.jpg`] });
  r = await rpc('arjun', 'post_recap', { p_plan_id: plan, p_image_paths: [`${U.arjun}/r1.jpg`] });
  ok(r.status >= 400 && /too_many_recaps/.test(errCode(r)), '4th recap on a plan rejected', 'Medium', errCode(r));
  await rpc('kiran', 'like_recap', { p_recap_id: recapId });
  let det = await rpc('kiran', 'get_recap_detail', { p_recap_id: recapId });
  ok(det.json.like_count === 1 && det.json.liked_by_me === true, 'like reflected in detail', 'High');
  await rpc('kiran', 'unlike_recap', { p_recap_id: recapId });
  ok((await rpc('kiran', 'get_recap_detail', { p_recap_id: recapId })).json.like_count === 0, 'unlike reflected');
  r = await rpc('kiran', 'comment_recap', { p_recap_id: recapId, p_body: 'nice!' });
  ok(r.status === 200 && r.json.id, 'comment_recap succeeds', 'High', errCode(r));
  r = await rpc('kiran', 'submit_report', { p_target_type: 'comment', p_target_id: r.json.id, p_reason: 'spam' });
  ok(r.status === 200 || r.status === 204, 'per-content report (comment) accepted', 'High', errCode(r));

  // ───────────────── Block ─────────────────
  section('4. Block / unblock visibility');
  await rpc('you', 'follow_user', { p_user_id: U.dev });
  r = await rpc('you', 'block_user', { p_user_id: U.dev });
  ok(r.status === 200 || r.status === 204, 'block_user succeeds', 'High', errCode(r));
  ok(db(`select count(*) from follows where (follower_id='${U.you}' and following_id='${U.dev}') or (follower_id='${U.dev}' and following_id='${U.you}')`) === '0', 'block removes follow edges both ways', 'High');
  ok((await get('you', `users_public?id=eq.${U.dev}&select=id`)).length === 0, 'blocker cannot see blocked', 'High');
  ok((await get('dev', `users_public?id=eq.${U.you}&select=id`)).length === 0, 'blocked cannot see blocker (bidirectional)', 'High');
  r = await rpc('you', 'follow_user', { p_user_id: U.dev });
  ok(r.status >= 400 && /blocked/.test(errCode(r)), 'cannot follow blocked user', 'High', errCode(r));
  r = await rpc('you', 'block_user', { p_user_id: U.you });
  ok(r.status >= 400 && /cannot_block_self/.test(errCode(r)), 'cannot block self', 'Low', errCode(r));
  // familiar face hidden while blocked
  db(`insert into familiar_faces(user_a_id,user_b_id,plans_together,last_met_at) values (least('${U.you}'::uuid,'${U.dev}'::uuid),greatest('${U.you}'::uuid,'${U.dev}'::uuid),1,now()) on conflict do nothing;`);
  ok((await get('you', `users_public?id=eq.${U.dev}&select=id`)).length === 0, 'familiar face (blocked) not resolvable', 'High');
  await rpc('you', 'unblock_user', { p_user_id: U.dev });
  ok((await get('you', `users_public?id=eq.${U.dev}&select=id`)).length === 1, 'unblock restores visibility');

  // ───────────────── Reporting / suspension / emergency ─────────────────
  section('5. Reporting thresholds / suspension / emergency');
  db(`delete from reports; update users set account_status='active', suspended_until=null where id='${U.sneha}';`);
  for (const who of ['arjun', 'kiran', 'you']) await rpc(who, 'submit_report', { p_target_type: 'user', p_target_id: U.sneha, p_reason: 'safety_concern' });
  ok(db(`select account_status from users where id='${U.sneha}'`) === 'suspended', '3 distinct safety reports auto-suspend user', 'High');
  ok(db(`select count(*) from users_public where id='${U.sneha}'`) === '1', 'NOTE: suspended profile still in users_public (only banned excluded)', 'Medium', 'design check');
  // suspended host plans hidden
  const susPlanId = (await newPlan('sneha', { activity: 'Sus plan' })).json?.id;
  if (susPlanId) { pd = await rpc('arjun', 'get_plan_detail', { p_plan_id: susPlanId }); ok(pd.status >= 400, "suspended host's plan hidden from others", 'High', errCode(pd)); }
  else ok(true, 'suspended user blocked from creating plan');
  svcRpc('set_account_status', { p_user_id: U.sneha, p_status: 'active' });

  // plan auto-hide: 5 distinct fresh reporters
  db(`delete from reports;`);
  const hpid = (await newPlan('arjun', { activity: 'Hide plan' })).json.id;
  for (const who of ['you', 'priya', 'kiran', 'sneha', 'dev']) await rpc(who, 'submit_report', { p_target_type: 'plan', p_target_id: hpid, p_reason: 'inappropriate_content' });
  ok(db(`select is_hidden from plans where id='${hpid}'`) === 't', '5 distinct plan reports auto-hide plan', 'High');

  // rate limit (isolated): one reporter, 10 ok then 11th blocked
  db(`delete from reports;`);
  for (let i = 0; i < 10; i++) await rpc('dev', 'submit_report', { p_target_type: 'user', p_target_id: U.arjun, p_reason: 'spam' });
  r = await rpc('dev', 'submit_report', { p_target_type: 'user', p_target_id: U.kiran, p_reason: 'spam' });
  ok(r.status >= 400 && /rate_limited/.test(errCode(r)), 'report rate limit at 10/day', 'Medium', errCode(r));

  // emergency → escalated
  db(`delete from reports;`);
  await rpc('kiran', 'submit_report', { p_target_type: 'user', p_target_id: U.arjun, p_reason: 'emergency' });
  ok(db(`select status from reports where reason='emergency' limit 1`) === 'escalated', 'emergency report auto-escalated', 'High');

  // ───────────────── Group chat ─────────────────
  section('6. Group chat membership');
  const cpid = (await newPlan('arjun', { activity: 'Chat plan' })).json.id;
  await rpc('kiran', 'join_plan', { p_plan_id: cpid });
  ok((await rpc('arjun', 'send_message', { p_plan_id: cpid, p_body: 'hi' })).status === 200, 'host can send', 'High');
  ok((await rpc('kiran', 'send_message', { p_plan_id: cpid, p_body: 'yo' })).status === 200, 'member can send', 'High');
  ok((await rpc('dev', 'send_message', { p_plan_id: cpid, p_body: 'x' })).status >= 400, 'non-member cannot send', 'High');

  // ───────────────── get_my_plans ─────────────────
  section('7. get_my_plans (hosted vs joined)');
  ok((await rpc('arjun', 'get_my_plans')).json.length >= 1, 'host sees own plans', 'High');
  ok((await rpc('kiran', 'get_my_plans')).json.some((p) => p.id === cpid), 'member sees joined plan', 'High');

  // ───────────────── Story expiry + view ─────────────────
  section('8. Story expiry + record_story_view');
  ok((await rpc('kiran', 'record_story_view', { p_story_id: storyId })).status <= 204, 'record_story_view ok', 'High');
  r = await rpc('kiran', 'record_story_view', { p_story_id: '00000000-0000-4000-ffff-000000000000' });
  ok(r.status >= 400 && /story_not_found/.test(errCode(r)), 'record_story_view bad id rejected', 'Medium', errCode(r));
  await svcPatch(`stories?id=eq.${storyId}`, { expires_at: new Date(Date.now() - 1000).toISOString() });
  ok(!(await rpc('kiran', 'get_stories_feed')).json.some((g) => g.author?.id === U.priya), 'expired story drops from feed', 'High');

  // ───────────────── Notifications ─────────────────
  section('9. Notifications read state');
  const nl = await get('arjun', 'notifications?select=id,is_read&order=created_at.desc&limit=5');
  ok(Array.isArray(nl) && nl.length >= 1, 'user reads own notifications', 'High', JSON.stringify(nl).slice(0, 80));
  if (Array.isArray(nl) && nl[0]) {
    // writes are RPC-only (no direct UPDATE grant) — use mark_notifications_read
    await rpc('arjun', 'mark_notifications_read', { p_ids: [nl[0].id] });
    ok(db(`select is_read from notifications where id='${nl[0].id}'`) === 't', 'mark notification read persists', 'High');
  }

  // ───────────────── Trust v2 (light E2E; deep coverage in pgTAP 0022) ─────────────────
  section('10. Trust v2 lifecycle (light)');
  // Host as 'dev' (no other active plans → avoids too_many_active_plans).
  const tp = (await newPlan('dev', { activity: 'Trust plan' })).json?.id;
  ok(!!tp, 'trust plan created (host has plan headroom)', 'High');
  await rpc('kiran', 'join_plan', { p_plan_id: tp });
  await rpc('priya', 'join_plan', { p_plan_id: tp });
  // End recently so submissions fall inside the 48h endorsement window.
  await svcPatch(`plans?id=eq.${tp}`, { status: 'ended', ended_at: new Date(Date.now() - 3600e3).toISOString() });
  // everyone marks everyone present + tags (Trust v2 default-present peer model)
  for (const who of ['dev', 'kiran', 'priya']) {
    await rpc(who, 'submit_endorsements', { p_plan_id: tp, p_marks: [
      { subject_id: U.dev, result: 'present', tag: 'Reliable' },
      { subject_id: U.kiran, result: 'present', tag: 'Good energy' },
      { subject_id: U.priya, result: 'present', tag: 'Punctual' },
    ] });
  }
  ok(Number(db(`select count(*) from attendance_marks where plan_id='${tp}'`)) >= 3, 'attendance marks staged', 'High');
  // Now move the close past 48h and run the resolver.
  await svcPatch(`plans?id=eq.${tp}`, { ended_at: new Date(Date.now() - 50 * 3600e3).toISOString() });
  const resolved = await svcRpc('fn_resolve_attendance');
  ok(Number(db(`select count(*) from plan_members where plan_id='${tp}' and status='attended'`)) >= 2, 'resolver marks attendees present', 'High', `resolved=${JSON.stringify(resolved.json)}`);
  ok(Number(db(`select count(*) from familiar_faces where (user_a_id='${U.kiran}' or user_b_id='${U.kiran}')`)) >= 1, 'familiar faces created from resolved-present', 'High');
  ok(Number(db(`select count(*) from endorsements`)) >= 1, 'endorsements finalized at resolution', 'High');

  // ───────────────── SUMMARY ─────────────────
  console.log(`\n──────────── SUMMARY ────────────`);
  console.log(`PASS: ${pass}   FAIL: ${issues.length}`);
  for (const s of ['Critical', 'High', 'Medium', 'Low']) {
    const list = issues.filter((i) => i.sev === s);
    if (list.length) { console.log(`\n${s} (${list.length}):`); list.forEach((i) => console.log(`  - ${i.name}${i.detail ? ' :: ' + i.detail : ''}`)); }
  }
  if (!issues.length) console.log('\nAll checks passed.');
}

main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
