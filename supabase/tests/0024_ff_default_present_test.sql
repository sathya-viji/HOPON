-- ============================================================================
-- Migration 0017 — pure default-present familiar faces (social-graph growth).
-- Faces form by default for everyone who shared an ended plan, pruned only by
-- self-no-show, ≥2-credible-flag, and blocks. The attendance SCORE stays
-- corroboration-gated (verified separately in 0022). Run: supabase test db
-- ============================================================================
begin;
select plan(23);

-- ── helpers (same shape as 0022) ────────────────────────────────────────────
create or replace function _su(uid text, h text) returns void language plpgsql as $FN$
begin
  insert into auth.users (id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
  values (uid::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
          '9'||right(replace(uid,'-',''),11), now(),now(),now()) on conflict (id) do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  perform complete_signup(h, h, '1990-01-01','man','HSR');
end $FN$;
create or replace function _plan(id text, host text) returns void language sql as $FN$
  insert into plans (id,host_id,category_id,activity,description,location_label,lat,lng,
    starts_at,capacity,spots_remaining,plan_type,status,cost,gender_pref,ended_at)
  values (id::uuid, host::uuid,'sports',id,'d','L',12.9,77.6, now()-interval '3 hours',
    9,8,'open','ended','free','all', now()-interval '49 hours') on conflict (id) do nothing;
$FN$;
create or replace function _mem(plan text, u text) returns void language sql as $FN$
  insert into plan_members(plan_id,user_id,status) values(plan::uuid,u::uuid,'joined')
  on conflict (plan_id,user_id) do nothing;
$FN$;
create or replace function _present(plan text, marker text, subjects text[]) returns void language plpgsql as $FN$
declare s text; begin
  foreach s in array subjects loop
    insert into attendance_marks(plan_id,marked_by,subject_id,result)
    values(plan::uuid,marker::uuid,s::uuid,'present')
    on conflict (plan_id,marked_by,subject_id) do update set result='present';
  end loop;
end $FN$;
create or replace function _flag(plan text, marker text, subject text) returns void language sql as $FN$
  insert into attendance_marks(plan_id,marked_by,subject_id,result)
  values(plan::uuid,marker::uuid,subject::uuid,'noshow')
  on conflict (plan_id,marked_by,subject_id) do update set result='noshow';
$FN$;
create or replace function _faces(u text) returns int language sql as $FN$
  select count(*)::int from familiar_faces where u in (user_a_id::text, user_b_id::text);
$FN$;
create or replace function _pair(a text, b text) returns boolean language sql as $FN$
  select exists(select 1 from familiar_faces
    where user_a_id=least(a::uuid,b::uuid) and user_b_id=greatest(a::uuid,b::uuid));
$FN$;

-- ── Fixtures: distinct users per scenario so face counts stay isolated ──────
-- pH: N=3, nobody submits          (H1 host, H2, H3)
select _su('80000000-0000-4000-a000-000000000001','@gH1');
select _su('80000000-0000-4000-a000-000000000002','@gH2');
select _su('80000000-0000-4000-a000-000000000003','@gH3');
-- pI: dyad, nobody submits         (I1 host, I2)
select _su('80000000-0000-4000-a000-000000000004','@gI1');
select _su('80000000-0000-4000-a000-000000000005','@gI2');
-- pJ: N=3, J2 self-no-show only    (J1 host, J2 self-noshow, J3)
select _su('80000000-0000-4000-a000-000000000006','@gJ1');
select _su('80000000-0000-4000-a000-000000000007','@gJ2');
select _su('80000000-0000-4000-a000-000000000008','@gJ3');
-- pK: N=4, K3 flagged by 2 credible (K1 host, K2, Kx, K3 flagged)
select _su('80000000-0000-4000-a000-000000000009','@gK1');
select _su('80000000-0000-4000-a000-000000000010','@gK2');
select _su('80000000-0000-4000-a000-000000000011','@gKx');
select _su('80000000-0000-4000-a000-000000000012','@gK3');
-- pL: N=3, nobody submits, L2 blocked L3 (L1 host, L2, L3)
select _su('80000000-0000-4000-a000-000000000013','@gL1');
select _su('80000000-0000-4000-a000-000000000014','@gL2');
select _su('80000000-0000-4000-a000-000000000015','@gL3');

-- pH — N=3, zero submissions
select _plan('80000000-0000-4000-b000-0000000000a1','80000000-0000-4000-a000-000000000001');
select _mem('80000000-0000-4000-b000-0000000000a1','80000000-0000-4000-a000-000000000002');
select _mem('80000000-0000-4000-b000-0000000000a1','80000000-0000-4000-a000-000000000003');

-- pI — dyad, zero submissions
select _plan('80000000-0000-4000-b000-0000000000a2','80000000-0000-4000-a000-000000000004');
select _mem('80000000-0000-4000-b000-0000000000a2','80000000-0000-4000-a000-000000000005');

-- pJ — N=3, J2 self-no-show (the only mark)
select _plan('80000000-0000-4000-b000-0000000000a3','80000000-0000-4000-a000-000000000006');
select _mem('80000000-0000-4000-b000-0000000000a3','80000000-0000-4000-a000-000000000007');
select _mem('80000000-0000-4000-b000-0000000000a3','80000000-0000-4000-a000-000000000008');
select _flag('80000000-0000-4000-b000-0000000000a3','80000000-0000-4000-a000-000000000007','80000000-0000-4000-a000-000000000007');

-- pK — N=4, K2 & Kx (credible) both flag K3 no-show
select _plan('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000009');
select _mem('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000010');
select _mem('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000011');
select _mem('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000012');
select _present('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000010',
  array['80000000-0000-4000-a000-000000000009','80000000-0000-4000-a000-000000000011']);
select _present('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000011',
  array['80000000-0000-4000-a000-000000000009','80000000-0000-4000-a000-000000000010']);
select _flag('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000010','80000000-0000-4000-a000-000000000012');
select _flag('80000000-0000-4000-b000-0000000000a4','80000000-0000-4000-a000-000000000011','80000000-0000-4000-a000-000000000012');

-- pL — N=3, zero submissions, L2 has blocked L3
select _plan('80000000-0000-4000-b000-0000000000a5','80000000-0000-4000-a000-000000000013');
select _mem('80000000-0000-4000-b000-0000000000a5','80000000-0000-4000-a000-000000000014');
select _mem('80000000-0000-4000-b000-0000000000a5','80000000-0000-4000-a000-000000000015');
insert into blocks (blocker_id, blocked_id)
  values ('80000000-0000-4000-a000-000000000014','80000000-0000-4000-a000-000000000015');

-- pM — N=3, host M1 flags ONLY M2 no-show (single pairwise flag)
select _su('80000000-0000-4000-a000-000000000016','@gM1');
select _su('80000000-0000-4000-a000-000000000017','@gM2');
select _su('80000000-0000-4000-a000-000000000018','@gM3');
select _plan('80000000-0000-4000-b000-0000000000a6','80000000-0000-4000-a000-000000000016');
select _mem('80000000-0000-4000-b000-0000000000a6','80000000-0000-4000-a000-000000000017');
select _mem('80000000-0000-4000-b000-0000000000a6','80000000-0000-4000-a000-000000000018');
select _flag('80000000-0000-4000-b000-0000000000a6','80000000-0000-4000-a000-000000000016','80000000-0000-4000-a000-000000000017');

-- ── Resolve ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', null, true);  -- service context
select ok((select fn_resolve_attendance()) >= 6, 'resolver processed the default-present plans');

-- pH: N=3 nobody submits → 3 faces (all pairs), but nobody resolved present (score-side untouched)
select is(_faces('80000000-0000-4000-a000-000000000001'),2,'pH: host has 2 familiar faces (default-present)');
select is(_faces('80000000-0000-4000-a000-000000000002'),2,'pH: H2 has 2 familiar faces');
select ok(_pair('80000000-0000-4000-a000-000000000002','80000000-0000-4000-a000-000000000003'),'pH: H2–H3 are familiar faces (no submission needed)');
select ok((select attendance_score from users where id='80000000-0000-4000-a000-000000000001') is null,'pH: host score still New (no corroboration)');
select ok(not exists(select 1 from plan_members where plan_id='80000000-0000-4000-b000-0000000000a1'::uuid and is_host_row),'pH: host UNRESOLVED on score side (no host row)');
select is((select status::text from plan_members where plan_id='80000000-0000-4000-b000-0000000000a1'::uuid and user_id='80000000-0000-4000-a000-000000000002'),'joined','pH: member status unchanged (joined)');

-- pI: dyad nobody submits → 1 face, both score-unresolved
select ok(_pair('80000000-0000-4000-a000-000000000004','80000000-0000-4000-a000-000000000005'),'pI: dyad with zero submissions → familiar face forms');
select ok(not exists(select 1 from plan_members where plan_id='80000000-0000-4000-b000-0000000000a2'::uuid and is_host_row),'pI: dyad host still score-UNRESOLVED');

-- pJ: self-no-show pruned from graph; the rest still pair
select is(_faces('80000000-0000-4000-a000-000000000007'),0,'pJ: self-no-show J2 excluded from familiar faces');
select ok(_pair('80000000-0000-4000-a000-000000000006','80000000-0000-4000-a000-000000000008'),'pJ: J1–J3 still become familiar faces');

-- pK: pairwise — K2 & Kx each flagged K3, so those two edges drop; the host (K1)
-- never flagged K3, so K1–K3 survives. K3 still resolves no-show on the SCORE side
-- (≥2 credible flaggers) — graph and score diverge by design.
select ok(not _pair('80000000-0000-4000-a000-000000000010','80000000-0000-4000-a000-000000000012'),'pK: K2 flagged K3 → K2–K3 edge dropped');
select ok(not _pair('80000000-0000-4000-a000-000000000011','80000000-0000-4000-a000-000000000012'),'pK: Kx flagged K3 → Kx–K3 edge dropped');
select ok(_pair('80000000-0000-4000-a000-000000000009','80000000-0000-4000-a000-000000000012'),'pK: host never flagged K3 → K1–K3 edge survives (pairwise)');
select is(_faces('80000000-0000-4000-a000-000000000012'),1,'pK: K3 keeps exactly the 1 unflagged edge');
select is((select status::text from plan_members where plan_id='80000000-0000-4000-b000-0000000000a4'::uuid and user_id='80000000-0000-4000-a000-000000000012'),'noshow','pK: K3 resolved no-show (score side, ≥2 flaggers)');

-- pL: blocked pair never connects, but the host still pairs with both
select ok(not _pair('80000000-0000-4000-a000-000000000014','80000000-0000-4000-a000-000000000015'),'pL: blocked L2–L3 never become familiar faces');
select ok(_pair('80000000-0000-4000-a000-000000000013','80000000-0000-4000-a000-000000000014'),'pL: host L1–L2 still pair');

-- pM: single pairwise flag — host flagged ONLY M2, so just the host–M2 edge drops;
-- M2 stays familiar with M3, and M2 is NOT no-show on the score side (1 flag < 2).
select ok(not _pair('80000000-0000-4000-a000-000000000016','80000000-0000-4000-a000-000000000017'),'pM: host flagged M2 → host–M2 edge dropped');
select ok(_pair('80000000-0000-4000-a000-000000000017','80000000-0000-4000-a000-000000000018'),'pM: M2–M3 edge survives (M3 never flagged M2)');
select ok(_pair('80000000-0000-4000-a000-000000000016','80000000-0000-4000-a000-000000000018'),'pM: host–M3 edge survives');
select is(_faces('80000000-0000-4000-a000-000000000017'),1,'pM: M2 keeps exactly 1 edge (with M3)');
select is((select status::text from plan_members where plan_id='80000000-0000-4000-b000-0000000000a6'::uuid and user_id='80000000-0000-4000-a000-000000000017'),'joined','pM: single flag ≠ no-show → M2 unresolved on score side');

select * from finish();
rollback;
