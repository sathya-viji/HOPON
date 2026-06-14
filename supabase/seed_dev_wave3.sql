-- ============================================================================
-- HopOn — Wave 3 DEV test data: notifications + chat messages for manual QA.
-- Re-runnable (fixed ids + ON CONFLICT DO NOTHING). NOT for production.
-- Depends on seed_dev_testdata.sql (uses Arjun + test users + edge plans).
-- Run:  docker exec -i <db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--         < supabase/seed_dev_wave3.sql
--
-- Notifications land in Arjun's feed (the QA login). Normally written by
-- notify() on real actions; the dev seed inserts memberships directly (no RPC),
-- so we fabricate a representative spread here. Chat messages seed the Dinner
-- meetup group chat (Arjun is host → can read/send).
-- ============================================================================
do $$
declare
  arjun  uuid := '00000000-0000-4000-a000-000000000001';
  priya  uuid := '00000000-0000-4000-a000-000000000002';
  ravi   uuid := '00000000-0000-4000-a200-000000000001';  -- Ravi Menon
  vikram uuid := '00000000-0000-4000-a200-000000000003';  -- Vikram Shah
  meera  uuid := '00000000-0000-4000-a200-000000000004';  -- Meera Iyer
  dinner uuid := '00000000-0000-4000-b200-000000000002';  -- Arjun's closed Dinner meetup
  qcoff  uuid := '00000000-0000-4000-b200-000000000007';  -- Quick coffee (Priya hosts)
begin
  if to_regclass('public.notifications') is null then
    raise notice 'seed_dev_wave3: notifications table absent — skipping'; return;
  end if;

  -- ── Notifications for Arjun (4 unread + 2 read) ─────────────────────────
  insert into notifications (id, user_id, type, is_read, plan_id, actor_id, body, created_at) values
    ('00000000-0000-4000-c100-000000000001', arjun, 'join_request'::notif_type, false, dinner, vikram,
     'Vikram Shah wants to join your Dinner meetup', now() - interval '4 minutes'),
    ('00000000-0000-4000-c100-000000000002', arjun, 'new_joiner'::notif_type, false, dinner, meera,
     'Meera Iyer joined your Dinner meetup', now() - interval '12 minutes'),
    ('00000000-0000-4000-c100-000000000003', arjun, 'mention'::notif_type, false, dinner, meera,
     'Meera Iyer mentioned you in Dinner meetup', now() - interval '20 minutes'),
    ('00000000-0000-4000-c100-000000000004', arjun, 'request_approved'::notif_type, false, qcoff, priya,
     'Priya K approved your request to join Quick coffee', now() - interval '50 minutes'),
    ('00000000-0000-4000-c100-000000000005', arjun, 'plan_starting_soon_joiner'::notif_type, true, qcoff, null,
     'Quick coffee starts soon at Koramangala Social.', now() - interval '2 hours'),
    ('00000000-0000-4000-c100-000000000006', arjun, 'welcome'::notif_type, true, null, null,
     'Welcome to hopon! Find plans happening near you.', now() - interval '3 days')
  on conflict (id) do nothing;

  -- ── Chat messages on Dinner meetup (Arjun host + Meera joined) ──────────
  insert into messages (id, plan_id, author_id, body, created_at) values
    ('00000000-0000-4000-d100-000000000001', dinner, meera, 'Looking forward to this!', now() - interval '40 minutes'),
    ('00000000-0000-4000-d100-000000000002', dinner, arjun, 'Welcome! We''ll meet at the entrance.', now() - interval '35 minutes'),
    ('00000000-0000-4000-d100-000000000003', dinner, meera, 'Perfect, see you then.', now() - interval '30 minutes')
  on conflict (id) do nothing;

  raise notice 'seed_dev_wave3: applied 6 notifications + 3 chat messages';
end $$;
