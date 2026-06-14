-- ============================================================================
-- QA utility — data-integrity / idempotency checks for the plan-loop mutations.
-- Exercises join/leave/approve/decline TWICE (+ a non-host approve) as real
-- callers (auth.uid via request.jwt.claims) and reports each outcome.
-- Wrapped in a transaction that ROLLS BACK, so the seeded baseline is untouched.
-- Run: docker exec -i <db> psql -U postgres -d postgres < supabase/qa_idempotency_check.sql
-- ============================================================================
begin;
do $$
declare
  arjun  uuid := '00000000-0000-4000-a000-000000000001';
  ravi   uuid := '00000000-0000-4000-a200-000000000001';  -- requester on Dinner
  anita  uuid := '00000000-0000-4000-a200-000000000002';  -- requester on Dinner
  outsdr uuid := '00000000-0000-4000-a200-000000000020';  -- not host of Dinner
  dinner uuid := '00000000-0000-4000-b200-000000000002';  -- Arjun closed, 3 requested
  openp  uuid := '00000000-0000-4000-b300-000000000001';  -- an open bulk plan
  n int;
  procedure_note text;
begin
  -- helper: act as a given user for subsequent RPC calls
  perform set_config('request.jwt.claims', json_build_object('sub', outsdr, 'role','authenticated')::text, true);

  -- ── JOIN TWICE (open plan) ────────────────────────────────────────────────
  begin perform join_plan(openp); raise notice 'JOIN #1: ok'; exception when others then raise notice 'JOIN #1: ERR %', sqlerrm; end;
  begin perform join_plan(openp); raise notice 'JOIN #2: ok (no error)'; exception when others then raise notice 'JOIN #2: ERR %', sqlerrm; end;
  select count(*) into n from plan_members where plan_id=openp and user_id=outsdr and not is_host_row;
  raise notice 'JOIN result: % membership row(s) for caller (expect 1 = idempotent)', n;

  -- ── LEAVE TWICE ───────────────────────────────────────────────────────────
  begin perform leave_plan(openp); raise notice 'LEAVE #1: ok'; exception when others then raise notice 'LEAVE #1: ERR %', sqlerrm; end;
  begin perform leave_plan(openp); raise notice 'LEAVE #2: ok (no error)'; exception when others then raise notice 'LEAVE #2: ERR %', sqlerrm; end;
  select count(*) into n from plan_members where plan_id=openp and user_id=outsdr and not is_host_row;
  raise notice 'LEAVE result: % active membership row(s) (expect 0)', n;

  -- ── NON-HOST APPROVE (authorization) ──────────────────────────────────────
  begin perform approve_request(dinner, ravi); raise notice 'NON-HOST APPROVE: ok (UNEXPECTED)'; exception when others then raise notice 'NON-HOST APPROVE: ERR % (expected not_host)', sqlerrm; end;

  -- ── APPROVE TWICE (as host) ───────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', arjun, 'role','authenticated')::text, true);
  begin perform approve_request(dinner, ravi); raise notice 'APPROVE #1: ok'; exception when others then raise notice 'APPROVE #1: ERR %', sqlerrm; end;
  begin perform approve_request(dinner, ravi); raise notice 'APPROVE #2: ok (no error)'; exception when others then raise notice 'APPROVE #2: ERR %', sqlerrm; end;
  select count(*) into n from plan_members where plan_id=dinner and user_id=ravi and status in ('approved','joined');
  raise notice 'APPROVE result: caller approved/joined row(s) = % (expect 1)', n;

  -- ── DECLINE TWICE (as host) ───────────────────────────────────────────────
  begin perform decline_request(dinner, anita); raise notice 'DECLINE #1: ok'; exception when others then raise notice 'DECLINE #1: ERR %', sqlerrm; end;
  begin perform decline_request(dinner, anita); raise notice 'DECLINE #2: ok (no error)'; exception when others then raise notice 'DECLINE #2: ERR %', sqlerrm; end;
  select status into procedure_note from plan_members where plan_id=dinner and user_id=anita;
  raise notice 'DECLINE result: anita status = % (expect declined)', coalesce(procedure_note,'<none>');
end $$;
rollback;
