/**
 * Wave 6 Gate — Phase 6 Safety & Moderation behavioral acceptance suite.
 *
 * Verifies BEHAVIOUR (not implementation) against docs/SAFETY_INTERACTION_MATRIX.md.
 * Drives the real PostgREST + Edge Functions as the seeded users / service role,
 * reads DB state via psql, and emits PASS/FAIL + evidence per acceptance criterion.
 *
 * Run after `supabase db reset`:  node scripts/gate_wave6_safety.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:54321';
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const ANON = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const U = { you:'00000000-0000-4000-a000-000000000000', arjun:'00000000-0000-4000-a000-000000000001', priya:'00000000-0000-4000-a000-000000000002', kiran:'00000000-0000-4000-a000-000000000003', sneha:'00000000-0000-4000-a000-000000000004', dev:'00000000-0000-4000-a000-000000000005' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, role='authenticated') => { const n=Math.floor(Date.now()/1e3); const h=b64({alg:'HS256',typ:'JWT'}); const p=b64({sub,role,aud:role,exp:n+3600,iat:n}); return `${h}.${p}.`+crypto.createHmac('sha256',SECRET).update(`${h}.${p}`).digest('base64url'); };
const TOK = Object.fromEntries(Object.entries(U).map(([k,v])=>[k,jwt(v)]));
const SVC = jwt('0','service_role');
async function call(token, method, path, body, raw=false) { const headers={apikey:ANON,Authorization:`Bearer ${token}`}; if(body!==undefined) headers['Content-Type']='application/json'; const res=await fetch(`${BASE}${path}`,{method,headers,body:body!==undefined?JSON.stringify(body):undefined}); const t=await res.text(); let j; try{j=t?JSON.parse(t):null;}catch{j=t;} return raw?{status:res.status,json:j}:j; }
const rpc = (who,fn,body={}) => call(TOK[who],'POST',`/rest/v1/rpc/${fn}`,body,true);
const get = (who,path) => call(TOK[who],'GET',`/rest/v1/${path}`);
const svcRpc = (fn,body={}) => call(SVC,'POST',`/rest/v1/rpc/${fn}`,body,true);
const svcPatch = (path,body) => call(SVC,'PATCH',`/rest/v1/${path}`,body,true);
const db = (sql) => execSync(`docker exec -i supabase_db_hopon psql -U postgres -d postgres -tAc ${JSON.stringify(sql)}`,{encoding:'utf8'}).trim();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const errc = (r) => (r.json && r.json.message) || `HTTP ${r.status}`;

const results = [];
function check(id, cond, name, evidence) { results.push({ id, pass: !!cond, name, evidence }); console.log(`${cond?'  ✅ PASS':'  ❌ FAIL'} [${id}] ${name}  ::  ${evidence}`); }
const section = (s) => console.log(`\n══ ${s} ══`);
const newPlan = (who, activity='Plan') => rpc(who,'create_plan',{p_category_id:'sports',p_activity:activity,p_location_label:'L',p_lat:12.9,p_lng:77.6,p_starts_at:new Date(Date.now()+3600e3).toISOString(),p_capacity:6,p_plan_type:'open',p_cost:'free',p_gender_pref:'all'});
async function startedPlan(who, activity) { const id=(await newPlan(who,activity)).json?.id; if(id) await svcPatch(`plans?id=eq.${id}`,{starts_at:new Date(Date.now()-7200e3).toISOString()}); return id; }
const resetReports = () => db('delete from reports;');
const audit = (action) => Number(db(`select count(*) from audit_logs where action='${action}'`));

async function main() {
  db(`delete from messages; delete from attendance_marks; delete from attendance_resolutions; delete from recap_comments; delete from recap_likes; delete from recaps; delete from stories; delete from follows; delete from blocks; delete from reports; delete from notifications; delete from familiar_faces; delete from plan_members where not is_host_row; delete from feed_events; delete from audit_logs; delete from contact_hashes; delete from plans where host_id <> '${U.you}'; update users set profile_visibility='everyone', plan_visibility='everyone', account_status='active', suspended_until=null, suspension_reason=null, deleted_at=null;`);

  // ════════ 1. BLOCK-PAIR INVISIBILITY ════════ (A=you blocks B=dev; C=arjun third party)
  section('1. BLOCK-PAIR INVISIBILITY');
  // pre: dev follows you (so there's a notif + follow to sever), dev hosts a started plan, posts story+recap (approved)
  await rpc('dev','follow_user',{p_user_id:U.you});
  const devPlan = await startedPlan('dev','Dev plan');
  await rpc('dev','post_story',{p_image_path:`${U.dev}/s.jpg`}); const devStory = db(`select id from stories where author_id='${U.dev}' order by created_at desc limit 1`); await svcRpc('approve_story',{p_story_id:devStory});
  await rpc('dev','post_recap',{p_plan_id:devPlan,p_image_paths:[`${U.dev}/r.jpg`]}); const devRecap = db(`select id from recaps where author_id='${U.dev}' order by created_at desc limit 1`); await svcRpc('approve_recap',{p_recap_id:devRecap});
  // dev's ACTIVE plan (to test block hides it from join), and a shared ACTIVE chat plan
  const devActivePlan = (await newPlan('dev','Dev active')).json.id;
  const chatPlan = (await newPlan('arjun','Chat plan')).json.id; await rpc('dev','join_plan',{p_plan_id:chatPlan});
  // third-party recap by arjun (started plan; dev comments — no membership needed)
  const arjPlan = await startedPlan('arjun','Arjun plan');
  await rpc('arjun','post_recap',{p_plan_id:arjPlan,p_image_paths:[`${U.arjun}/r.jpg`]}); const arjRecap = db(`select id from recaps where author_id='${U.arjun}' order by created_at desc limit 1`); await svcRpc('approve_recap',{p_recap_id:arjRecap});
  const devComment = (await rpc('dev','comment_recap',{p_recap_id:arjRecap,p_body:'devcomment'})).json?.id;
  // familiar face between you and dev
  db(`insert into familiar_faces(user_a_id,user_b_id,plans_together,last_met_at) values (least('${U.you}'::uuid,'${U.dev}'::uuid),greatest('${U.you}'::uuid,'${U.dev}'::uuid),1,now()) on conflict do nothing;`);

  // BLOCK
  await rpc('you','block_user',{p_user_id:U.dev});
  let r = await get('you',`users_public?id=eq.${U.dev}&select=id`); check('BP1a', Array.isArray(r)&&r.length===0, 'blocker cannot see blocked profile', `rows=${r.length}`);
  r = await get('dev',`users_public?id=eq.${U.you}&select=id`); check('BP1b', Array.isArray(r)&&r.length===0, 'blocked cannot see blocker profile (bidirectional)', `rows=${r.length}`);
  let pd = await rpc('you','get_plan_detail',{p_plan_id:devActivePlan}); check('BP2a', pd.status>=400&&/plan_not_found/.test(errc(pd)), "blocked user's (active) plan hidden from blocker", errc(pd));
  let jr = await rpc('you','join_plan',{p_plan_id:devActivePlan}); check('BP2b', jr.status>=400, 'blocker cannot join blocked user plan', errc(jr));
  let sf = await rpc('you','get_stories_feed'); check('BP3', !sf.json.some(g=>g.author?.id===U.dev), "blocked user's story hidden from blocker feed", `present=${sf.json.some(g=>g.author?.id===U.dev)}`);
  let rf = await rpc('you','get_recaps_feed'); check('BP4a', !rf.json.some(x=>x.id===devRecap), "blocked user's recap hidden from blocker feed", `present=${rf.json.some(x=>x.id===devRecap)}`);
  let rd = await rpc('you','get_recap_detail',{p_recap_id:devRecap}); check('BP4b', rd.status>=400&&/recap_not_found/.test(errc(rd)), "blocked user's recap detail blocked", errc(rd));
  // BP5: dev's comment on arjun's (third-party) recap hidden from you
  let arjDetail = await rpc('you','get_recap_detail',{p_recap_id:arjRecap}); const sees = (arjDetail.json?.comments??[]).some(c=>c.id===devComment); check('BP5', arjDetail.status===200&&!sees, "blocked user's comment on third-party recap hidden (0014j)", `visible=${sees}`);
  // BP6: familiar faces hidden
  let ff = await get('you',`familiar_faces?or=(user_a_id.eq.${U.dev},user_b_id.eq.${U.dev})&select=user_a_id`); check('BP6', Array.isArray(ff)&&ff.length===0, 'blocked user hidden from Familiar Faces (0014j)', `rows=${ff.length}`);
  // BP7: notifications from blocked actor excluded (dev followed you → new_follower actor=dev)
  let nf = await rpc('you','get_notifications'); const hasDevNotif = (nf.json??[]).some(n=>n.actor_id===U.dev); check('BP7', !hasDevNotif, 'notifications from blocked actor excluded (0014j)', `present=${hasDevNotif}`);
  // BP8: contact matching excludes blocked
  let cm = await (await fetch(`${BASE}/functions/v1/contacts-match`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${TOK.you}`,'Content-Type':'application/json'},body:JSON.stringify({hashes:[sha('+919999999996'),sha('+919999999993')]})})).json();
  check('BP8', !(cm.matches??[]).some(m=>m.id===U.dev), 'contact matching excludes blocked user (0014j)', `matches=${(cm.matches??[]).map(m=>m.handle).join(',')||'none'}`);
  // BP9: follow blocked → error
  let fr = await rpc('you','follow_user',{p_user_id:U.dev}); check('BP9', fr.status>=400&&/blocked/.test(errc(fr)), 'cannot follow a blocked user', errc(fr));
  // BP10: shared-plan messages stay visible (decision #4). you+dev both in chatPlan (active).
  await rpc('you','join_plan',{p_plan_id:chatPlan}); const devSend = await rpc('dev','send_message',{p_plan_id:chatPlan,p_body:'hi from dev'});
  let msgs = await get('you',`messages?plan_id=eq.${chatPlan}&select=author_id,body`); const seesMsg = Array.isArray(msgs)&&msgs.some(m=>m.author_id===U.dev); check('BP10', seesMsg, 'shared-plan messages from blocked user STAY visible (decision #4)', `devSend=${devSend.status} seesDevMsg=${seesMsg}`);
  // BP11: follows severed both ways
  let fcount = db(`select count(*) from follows where (follower_id='${U.dev}' and following_id='${U.you}') or (follower_id='${U.you}' and following_id='${U.dev}')`); check('BP11', fcount==='0', 'block severs follow edges both directions', `edges=${fcount}`);
  // unblock restores profile; follows NOT restored
  await rpc('you','unblock_user',{p_user_id:U.dev});
  r = await get('you',`users_public?id=eq.${U.dev}&select=id`); check('BP12a', Array.isArray(r)&&r.length===1, 'unblock restores profile visibility', `rows=${r.length}`);
  check('BP12b', db(`select count(*) from follows where follower_id='${U.dev}' and following_id='${U.you}'`)==='0', 'unblock does NOT restore severed follows (decision)', 'follows stay severed');

  // ════════ 2. SUSPENSION ENFORCEMENT ════════ (suspend dev)
  section('2. SUSPENSION ENFORCEMENT');
  await svcRpc('set_account_status',{p_user_id:U.dev,p_status:'suspended',p_reason:'gate test',p_until:new Date(Date.now()+7*864e5).toISOString()});
  check('SU0', db(`select account_status from users where id='${U.dev}'`)==='suspended', 'user is suspended', db(`select account_status from users where id='${U.dev}'`));
  let s1 = await newPlan('dev','susplan'); check('SU1', s1.status>=400, 'suspended cannot create_plan', errc(s1));
  let s2 = await rpc('dev','join_plan',{p_plan_id:arjPlan}); check('SU2', s2.status>=400, 'suspended cannot join_plan', errc(s2));
  let s3 = await rpc('dev','post_recap',{p_plan_id:arjPlan,p_image_paths:[`${U.dev}/x.jpg`]}); check('SU3', s3.status>=400, 'suspended cannot post_recap', errc(s3));
  let s4 = await rpc('dev','post_story',{p_image_path:`${U.dev}/x.jpg`}); check('SU4', s4.status>=400, 'suspended cannot post_story', errc(s4));
  let s5 = await rpc('dev','comment_recap',{p_recap_id:arjRecap,p_body:'x'}); check('SU5', s5.status>=400, 'suspended cannot comment', errc(s5));
  let s6 = await rpc('dev','follow_user',{p_user_id:U.priya}); check('SU6', s6.status>=400, 'suspended cannot follow', errc(s6));
  let s7 = await rpc('dev','send_message',{p_plan_id:arjPlan,p_body:'x'}); check('SU7', s7.status>=400, 'suspended cannot send_message', errc(s7));
  let sv = await get('arjun',`users_public?id=eq.${U.dev}&select=id`); check('SU8', Array.isArray(sv)&&sv.length===1, 'suspended profile STILL visible in users_public (decision #7)', `rows=${sv.length}`);
  // lifecycle reactivation
  await svcRpc('set_account_status',{p_user_id:U.dev,p_status:'suspended',p_reason:'expired',p_until:new Date(Date.now()-3600e3).toISOString()});
  const reexp = await svcRpc('fn_expire_suspensions');
  check('SU9', db(`select account_status from users where id='${U.dev}'`)==='active', 'fn_expire_suspensions reactivates after suspended_until', `status=${db(`select account_status from users where id='${U.dev}'`)} n=${JSON.stringify(reexp.json)}`);

  // ════════ 3. EMERGENCY ESCALATION ════════
  section('3. EMERGENCY ESCALATION');
  resetReports();
  await rpc('kiran','submit_report',{p_target_type:'user',p_target_id:U.arjun,p_reason:'emergency'});
  check('EM1', db(`select status from reports where reason='emergency' order by created_at desc limit 1`)==='escalated', 'emergency report status forced to escalated (trigger)', db(`select status from reports where reason='emergency' order by created_at desc limit 1`));
  check('EM2', db(`select account_status from users where id='${U.arjun}'`)==='active', 'emergency on USER does NOT auto-suspend (decision #6)', db(`select account_status from users where id='${U.arjun}'`));
  // EM3: emergency-escalation edge fn on a plan → is_hidden + audit
  resetReports();
  const emPlan = (await newPlan('arjun','EmPlan')).json.id;
  await rpc('priya','submit_report',{p_target_type:'plan',p_target_id:emPlan,p_reason:'emergency'});
  const emReport = db(`select id from reports where target_type='plan' and target_id='${emPlan}' limit 1`);
  const emRes = await (await fetch(`${BASE}/functions/v1/emergency-escalation`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${SVC}`,'Content-Type':'application/json'},body:JSON.stringify({report_id:emReport,target_type:'plan',target_id:emPlan})})).json().catch(()=>({}));
  check('EM3a', db(`select is_hidden from plans where id='${emPlan}'`)==='t', 'emergency-escalation edge fn hides the reported plan', `is_hidden=${db(`select is_hidden from plans where id='${emPlan}'`)} res=${JSON.stringify(emRes)}`);
  check('EM3b', audit('emergency_escalated')>=1, 'emergency_escalated audit row written', `count=${audit('emergency_escalated')}`);

  // ════════ 5. MODERATION THRESHOLDS ════════ (do before deletion; reset reports each)
  section('5. MODERATION THRESHOLDS');
  // MT2 recap: 3 distinct reporters → rejected
  resetReports();
  for (const w of ['you','priya','kiran']) await rpc(w,'submit_report',{p_target_type:'recap',p_target_id:arjRecap,p_reason:'inappropriate_content'});
  check('MT2', db(`select moderation from recaps where id='${arjRecap}'`)==='rejected', 'recap auto-rejected at 3 distinct reports', db(`select moderation from recaps where id='${arjRecap}'`));
  // MT7 below-threshold: new recap, 2 reports → still approved
  resetReports();
  await rpc('arjun','post_recap',{p_plan_id:arjPlan,p_image_paths:[`${U.arjun}/r2.jpg`]}); const r2=db(`select id from recaps where author_id='${U.arjun}' order by created_at desc limit 1`); await svcRpc('approve_recap',{p_recap_id:r2});
  for (const w of ['you','priya']) await rpc(w,'submit_report',{p_target_type:'recap',p_target_id:r2,p_reason:'spam'});
  check('MT7', db(`select moderation from recaps where id='${r2}'`)==='approved', 'recap NOT hidden below threshold (2 reports)', db(`select moderation from recaps where id='${r2}'`));
  // MT8 distinct enforcement: same reporter 3x on a 3rd recap → no action (1 distinct)
  resetReports();
  await rpc('arjun','post_recap',{p_plan_id:arjPlan,p_image_paths:[`${U.arjun}/r3.jpg`]}); const r3=db(`select id from recaps where author_id='${U.arjun}' order by created_at desc limit 1`); await svcRpc('approve_recap',{p_recap_id:r3});
  for (let i=0;i<3;i++) await rpc('you','submit_report',{p_target_type:'recap',p_target_id:r3,p_reason:'spam'});
  check('MT8', db(`select moderation from recaps where id='${r3}'`)==='approved', 'threshold counts DISTINCT reporters (same reporter x3 → no action)', db(`select moderation from recaps where id='${r3}'`));
  // MT3 story
  resetReports();
  for (const w of ['you','priya','kiran']) await rpc(w,'submit_report',{p_target_type:'story',p_target_id:devStory,p_reason:'inappropriate_content'});
  check('MT3', db(`select moderation from stories where id='${devStory}'`)==='rejected', 'story auto-rejected at 3 distinct reports', db(`select moderation from stories where id='${devStory}'`));
  // MT4 comment (re-create a comment on r2 by priya, 3 reporters)
  resetReports();
  const cmt = (await rpc('priya','comment_recap',{p_recap_id:r2,p_body:'hello'})).json?.id;
  for (const w of ['you','kiran','sneha']) await rpc(w,'submit_report',{p_target_type:'comment',p_target_id:cmt,p_reason:'harassment'});
  check('MT4', db(`select is_deleted from recap_comments where id='${cmt}'`)==='t', 'comment soft-deleted at 3 distinct reports', `is_deleted=${db(`select is_deleted from recap_comments where id='${cmt}'`)}`);
  // MT5 message (active chat plan, priya joins + sends, 3 reporters)
  resetReports();
  await rpc('priya','join_plan',{p_plan_id:chatPlan}); const pmsg=(await rpc('priya','send_message',{p_plan_id:chatPlan,p_body:'hey all'})).json?.id;
  for (const w of ['you','kiran','sneha']) await rpc(w,'submit_report',{p_target_type:'message',p_target_id:pmsg,p_reason:'harassment'});
  check('MT5', db(`select is_deleted from messages where id='${pmsg}'`)==='t', 'message soft-deleted at 3 distinct reports', `is_deleted=${db(`select is_deleted from messages where id='${pmsg}'`)}`);
  // MT6 plan auto-hide at 5
  resetReports();
  const hp=(await newPlan('arjun','HidePlan')).json.id;
  for (const w of ['you','priya','kiran','sneha','dev']) await rpc(w,'submit_report',{p_target_type:'plan',p_target_id:hp,p_reason:'inappropriate_content'});
  check('MT6', db(`select is_hidden from plans where id='${hp}'`)==='t', 'plan auto-hidden at 5 distinct reports', `is_hidden=${db(`select is_hidden from plans where id='${hp}'`)}`);
  // MT1 user suspend at 3 safety
  resetReports();
  for (const w of ['you','priya','kiran']) await rpc(w,'submit_report',{p_target_type:'user',p_target_id:U.sneha,p_reason:'safety_concern'});
  check('MT1', db(`select account_status from users where id='${U.sneha}'`)==='suspended', 'user auto-suspended at 3 distinct safety_concern reports', db(`select account_status from users where id='${U.sneha}'`));
  await svcRpc('set_account_status',{p_user_id:U.sneha,p_status:'active'});

  // ════════ 7. REPORT WORKFLOWS ════════
  section('7. REPORT WORKFLOWS');
  resetReports();
  let rw = await rpc('you','submit_report',{p_target_type:'user',p_target_id:U.arjun,p_reason:'spam'}); check('RW1', rw.status<=204 && Number(db(`select count(*) from reports`))>=1, 'submit_report inserts a report row', `status=${rw.status} rows=${db(`select count(*) from reports`)}`);
  // RW2 per-content target types accepted
  let acc=true, accDetail=[]; for (const t of ['recap','story','comment','message']) { resetReports(); const tid = t==='recap'?r2:t==='story'?devStory:t==='comment'?cmt:pmsg; const rr=await rpc('kiran','submit_report',{p_target_type:t,p_target_id:tid,p_reason:'spam'}); if(rr.status>204){acc=false;} accDetail.push(`${t}:${rr.status}`);} check('RW2', acc, 'per-content report target types accepted (recap/story/comment/message)', accDetail.join(' '));
  // RW3 rate limit
  resetReports();
  for (let i=0;i<10;i++) await rpc('dev','submit_report',{p_target_type:'user',p_target_id:U.arjun,p_reason:'spam'});
  let rl = await rpc('dev','submit_report',{p_target_type:'user',p_target_id:U.priya,p_reason:'spam'}); check('RW3', rl.status>=400&&/rate_limited/.test(errc(rl)), 'reporter rate limit enforced at 10/day', errc(rl));
  // RW4 reports admin-only (no client SELECT)
  let rsel = await get('you','reports?select=id&limit=1');
  const reportsBlocked = (Array.isArray(rsel) && rsel.length === 0) || (rsel && (rsel.code === '42501' || rsel.code === 'PGRST301'));
  check('RW4', reportsBlocked, 'reports table not client-readable (admin-only RLS)', Array.isArray(rsel) ? `rows=${rsel.length}` : `denied code=${rsel?.code}`);
  // RW6 silent: reporting creates no notification for reporter or target
  resetReports(); const nBefore=Number(db(`select count(*) from notifications`)); await rpc('you','submit_report',{p_target_type:'user',p_target_id:U.kiran,p_reason:'spam'}); const nAfter=Number(db(`select count(*) from notifications`));
  check('RW6', nAfter===nBefore, 'report submission is silent (no notification to reporter/target)', `notifs ${nBefore}->${nAfter}`);

  // ════════ 6. AUDIT LOGGING ════════ (assert the rows produced above)
  section('6. AUDIT LOGGING');
  check('AU1', audit('account_status_changed')>=1, 'audit: account_status_changed (on suspend)', `count=${audit('account_status_changed')}`);
  check('AU2', audit('recap_auto_hidden')>=1, 'audit: recap_auto_hidden', `count=${audit('recap_auto_hidden')}`);
  check('AU3', audit('story_auto_hidden')>=1, 'audit: story_auto_hidden', `count=${audit('story_auto_hidden')}`);
  check('AU4', audit('comment_auto_hidden')>=1, 'audit: comment_auto_hidden', `count=${audit('comment_auto_hidden')}`);
  check('AU5', audit('message_auto_hidden')>=1, 'audit: message_auto_hidden', `count=${audit('message_auto_hidden')}`);
  check('AU6', audit('plan_auto_hidden')>=1, 'audit: plan_auto_hidden', `count=${audit('plan_auto_hidden')}`);
  check('AU7', audit('emergency_escalated')>=1, 'audit: emergency_escalated', `count=${audit('emergency_escalated')}`);

  // ════════ 4. ACCOUNT DELETION LIFECYCLE ════════ (dev — destructive; do last)
  section('4. ACCOUNT DELETION LIFECYCLE');
  // give dev content + relationships + trust rows
  await rpc('dev','follow_user',{p_user_id:U.priya});
  db(`insert into familiar_faces(user_a_id,user_b_id,plans_together,last_met_at) values (least('${U.dev}'::uuid,'${U.priya}'::uuid),greatest('${U.dev}'::uuid,'${U.priya}'::uuid),1,now()) on conflict do nothing;`);
  db(`insert into push_tokens(user_id,token,platform) values ('${U.dev}','devtok','ios') on conflict do nothing;`);
  db(`insert into contact_hashes(owner_id,phone_hash) values ('${U.dev}','${sha('+910000000001')}') on conflict do nothing;`);
  // trust rows for dev on arjPlan (must be preserved)
  db(`insert into attendance_marks(plan_id,marked_by,subject_id,result) values ('${arjPlan}','${U.dev}','${U.dev}','present') on conflict do nothing;`);
  db(`insert into endorsements(plan_id,giver_id,receiver_id,tag) values ('${arjPlan}','${U.priya}','${U.dev}','Reliable') on conflict do nothing;`);
  const devStoriesBefore = Number(db(`select count(*) from stories where author_id='${U.dev}'`));
  // soft delete (as dev)
  const del = await rpc('dev','delete_account');
  check('DL1', del.status<=204 && db(`select (deleted_at is not null) and account_status='suspended' from users where id='${U.dev}'`)==='t', 'delete_account soft-deletes (deleted_at + suspended)', db(`select account_status||' deleted='||(deleted_at is not null) from users where id='${U.dev}'`));
  let dv = await get('arjun',`users_public?id=eq.${U.dev}&select=id`); check('DL2', Array.isArray(dv)&&dv.length===0, 'soft-deleted user hidden from users_public', `rows=${dv.length}`);
  // backdate + hard delete
  db(`update users set deleted_at = now() - interval '31 days' where id='${U.dev}';`);
  const hd = await svcRpc('fn_hard_delete_accounts');
  const after = db(`select name||'|'||handle||'|'||account_status||'|'||coalesce(gender::text,'')||'|'||dob from users where id='${U.dev}'`);
  check('DL4', /^\[deleted\]\|@del_.*\|banned\|prefer_not\|1900-01-01/.test(after), 'hard delete anonymises in place (name/handle/banned/gender/dob)', after);
  check('DL4b', db(`select coalesce(phone,'null')||'/'||coalesce(email,'null') from auth.users where id='${U.dev}'`)==='null/null', 'hard delete nulls auth phone/email', db(`select coalesce(phone,'null')||'/'||coalesce(email,'null') from auth.users where id='${U.dev}'`));
  check('DL5a', db(`select count(*) from stories where author_id='${U.dev}'`)==='0' && devStoriesBefore>=1, 'hard delete removes stories', `${devStoriesBefore}->${db(`select count(*) from stories where author_id='${U.dev}'`)}`);
  check('DL5b', db(`select count(*) from recaps where author_id='${U.dev}'`)==='0', 'hard delete removes recaps', `recaps=${db(`select count(*) from recaps where author_id='${U.dev}'`)}`);
  check('DL5c', db(`select count(*) from follows where follower_id='${U.dev}' or following_id='${U.dev}'`)==='0', 'hard delete removes follows both ways', `follows=${db(`select count(*) from follows where follower_id='${U.dev}' or following_id='${U.dev}'`)}`);
  check('DL5d', db(`select count(*) from familiar_faces where user_a_id='${U.dev}' or user_b_id='${U.dev}'`)==='0', 'hard delete removes familiar_faces', `ff=${db(`select count(*) from familiar_faces where user_a_id='${U.dev}' or user_b_id='${U.dev}'`)}`);
  check('DL5e', db(`select count(*) from push_tokens where user_id='${U.dev}'`)==='0' && db(`select count(*) from contact_hashes where owner_id='${U.dev}'`)==='0', 'hard delete removes push_tokens + contact_hashes', 'cleared');
  check('DL6', Number(db(`select count(*) from attendance_marks where subject_id='${U.dev}'`))>=1 && Number(db(`select count(*) from endorsements where receiver_id='${U.dev}'`))>=1, 'TRUST GRAPH PRESERVED (attendance_marks + endorsements kept)', `marks=${db(`select count(*) from attendance_marks where subject_id='${U.dev}'`)} endorsements=${db(`select count(*) from endorsements where receiver_id='${U.dev}'`)}`);
  check('AU8', audit('account_hard_deleted')>=1, 'audit: account_hard_deleted', `count=${audit('account_hard_deleted')} hd=${JSON.stringify(hd.json)}`);

  // ════════ SUMMARY ════════
  const passed = results.filter(r=>r.pass).length, failed = results.filter(r=>!r.pass);
  console.log(`\n════════ GATE SUMMARY ════════`);
  console.log(`Criteria: ${results.length}   PASS: ${passed}   FAIL: ${failed.length}`);
  if (failed.length) { console.log('\nFAILURES:'); failed.forEach(f=>console.log(`  [${f.id}] ${f.name} :: ${f.evidence}`)); }
  else console.log('\n✅ ALL WAVE 6 SAFETY GATE CRITERIA PASS');
}
main().catch((e)=>{console.error('GATE ERROR',e);process.exit(1);});
