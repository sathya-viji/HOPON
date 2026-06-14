-- ============================================================================
-- HopOn — extra DEV test data for manual QA (30 users + 30 plans).
-- Re-runnable (ON CONFLICT DO NOTHING). NOT for production.
-- Run:  docker exec -i <supabase_db_container> psql -U postgres -d postgres \
--         -v ON_ERROR_STOP=1 < supabase/seed_dev_testdata.sql
--
-- Timing is spread now()+~1h .. now()+~13d so plans stay future for days
-- (avoids repeated db resets). spots_remaining is auto-maintained by
-- trg_sync_spots (remaining = capacity - 1 - joined/approved members).
--
-- Test users: 00000000-0000-4000-a200-0000000000NN  (NN = 01..30)
-- Edge plans: 00000000-0000-4000-b200-0000000000NN
-- Bulk plans: 00000000-0000-4000-b300-0000000000NN
-- The phone-OTP login user for QA is Arjun R (00000000-0000-4000-a000-000000000001).
-- ============================================================================
do $$
declare
  i      int;
  uid    uuid;
  arjun  uuid := '00000000-0000-4000-a000-000000000001';
  priya  uuid := '00000000-0000-4000-a000-000000000002';
  kiran  uuid := '00000000-0000-4000-a000-000000000003';
  sneha  uuid := '00000000-0000-4000-a000-000000000004';
  dev    uuid := '00000000-0000-4000-a000-000000000005';
  names  text[] := array[
    'Ravi Menon','Anita Rao','Vikram Shah','Meera Iyer','Karan Gupta','Divya Nair',
    'Rohit Verma','Sana Khan','Aditya Joshi','Pooja Reddy','Nikhil Das','Tara Bose',
    'Manish Pillai','Leela Krishnan','Sameer Ali','Nisha Patel','Varun Hegde','Ritu Sharma',
    'Gaurav Malhotra','Ananya Ghosh','Siddharth Rao','Kavya Suresh','Arnav Kapoor','Ishita Roy',
    'Dev Narayan','Maya Pillai','Yash Agarwal','Riya Sen','Aman Bhat','Neha Kulkarni'];
  hoods  text[] := array['HSR Layout','Koramangala','Indiranagar','Jayanagar','Whitefield','BTM Layout'];
  cats   text[] := array['sports','food','outdoors','entertainment','social','arts','learning','other'];
  acts   text[] := array['Morning run','Coffee catch-up','Cricket nets','Board games night','Nandi trek',
                         'Live music','Book club','Cycling ride','Football 5s','Sunday brunch','Photowalk','Evening yoga'];
  locs   text[] := array['Cubbon Park','Church Street','Lalbagh','Koramangala Social','HSR BDA Complex',
                         'Indiranagar 100ft','Jayanagar 4th Block','Whitefield Forum'];
  lats   numeric[] := array[12.9763,12.9756,12.9507,12.9352,12.9116,12.9719,12.9250,12.9698];
  lngs   numeric[] := array[77.5929,77.6068,77.5848,77.6245,77.6370,77.6412,77.5938,77.7499];
  costs  text[] := array['free','copay','seeking','sponsored'];
  li     int;
begin
  if to_regclass('public.users') is null or to_regclass('public.plans') is null then
    raise notice 'seed_dev_testdata: schema not migrated — skipping';
    return;
  end if;

  -- ── 30 test users (auth shells + profiles) ─────────────────────────────
  for i in 1..30 loop
    uid := ('00000000-0000-4000-a200-' || lpad(i::text,12,'0'))::uuid;
    insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at,
           confirmation_token, recovery_token, email_change_token_new, email_change,
           phone_change, phone_change_token, email_change_token_current, reauthentication_token)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           '9181' || lpad(i::text,7,'0'), now(), now(), now(), '','','','','','','','')
    on conflict (id) do nothing;

    insert into public.users
      (id, name, handle, neighbourhood, bio, dob, gender, verification_level,
       plans_hosted, plans_attended, people_met, attendance_score)
    values (
      uid, names[i], '@' || lower(split_part(names[i],' ',1)) || '_' || i,
      hoods[1 + (i % array_length(hoods,1))], 'Test profile ' || i,
      (date '1990-01-01' + (i*73)), (array['man','woman','nonbinary'])[1 + (i % 3)]::gender_t,
      (case when i % 2 = 0 then 'phone' else 'none' end)::verification_level,
      (i % 10), (i % 20), (i % 30), 80 + (i % 20))
    on conflict (id) do nothing;
  end loop;

  -- ── Edge-case plans (fixed ids) ────────────────────────────────────────
  insert into public.plans
    (id, host_id, category_id, activity, description, location_label, lat, lng,
     starts_at, capacity, spots_remaining, plan_type, status, cost, cost_note, gender_pref)
  values
    -- Arjun hosts: OPEN (host view / edit / cancel)
    ('00000000-0000-4000-b200-000000000001', arjun, 'sports', 'Badminton doubles',
     'Need 2 more for doubles.', 'HSR BDA Complex', 12.9116, 77.6370,
     now() + interval '3 hours', 5, 4, 'open', 'active', 'copay', '₹150/person', 'all'),
    -- Arjun hosts: CLOSED with pending requests (approve/decline)
    ('00000000-0000-4000-b200-000000000002', arjun, 'food', 'Dinner meetup',
     'Casual dinner, request to join.', 'Koramangala Social', 12.9352, 77.6245,
     now() + interval '2 days', 6, 5, 'closed', 'active', 'free', null, 'all'),
    -- Women-only (Arjun = man → gender_mismatch)
    ('00000000-0000-4000-b200-000000000003', priya, 'outdoors', 'Ladies sunset walk',
     'Easy evening stroll.', 'Lalbagh', 12.9507, 77.5848,
     now() + interval '5 hours', 6, 5, 'open', 'active', 'free', null, 'women'),
    -- Men-only (Arjun = man → can join)
    ('00000000-0000-4000-b200-000000000004', dev, 'sports', 'Mens football 7s',
     'Turf booked.', 'HSR BDA Complex', 12.9116, 77.6371,
     now() + interval '6 hours', 10, 9, 'open', 'active', 'copay', '₹100/person', 'men'),
    -- Full (capacity 2 + 1 joined → full; button disabled)
    ('00000000-0000-4000-b200-000000000005', kiran, 'food', 'Coffee tasting',
     'Small group only.', 'Church Street', 12.9756, 77.6068,
     now() + interval '7 hours', 2, 1, 'open', 'active', 'free', null, 'all'),
    -- Closed (not Arjun → Arjun can request)
    ('00000000-0000-4000-b200-000000000006', sneha, 'entertainment', 'Movie night',
     'Approve each request.', 'Indiranagar 100ft', 12.9719, 77.6412,
     now() + interval '8 hours', 5, 4, 'closed', 'active', 'free', null, 'all'),
    -- Near-term OPEN all-gender (NOW section + joinable)
    ('00000000-0000-4000-b200-000000000007', priya, 'food', 'Quick coffee',
     'Come as you are.', 'Koramangala Social', 12.9352, 77.6246,
     now() + interval '90 minutes', 5, 4, 'open', 'active', 'free', null, 'all')
  on conflict (id) do nothing;

  -- Members for edge plans (trigger recomputes spots / full-status)
  insert into public.plan_members (plan_id, user_id, status) values
    -- Arjun's closed dinner: 3 pending requests + 1 joined attendee
    ('00000000-0000-4000-b200-000000000002','00000000-0000-4000-a200-000000000001','requested'),
    ('00000000-0000-4000-b200-000000000002','00000000-0000-4000-a200-000000000002','requested'),
    ('00000000-0000-4000-b200-000000000002','00000000-0000-4000-a200-000000000003','requested'),
    ('00000000-0000-4000-b200-000000000002','00000000-0000-4000-a200-000000000004','joined'),
    -- Coffee tasting: 1 joined → full
    ('00000000-0000-4000-b200-000000000005', sneha, 'joined'),
    -- Quick coffee: 2 joined
    ('00000000-0000-4000-b200-000000000007','00000000-0000-4000-a200-000000000005','joined'),
    ('00000000-0000-4000-b200-000000000007','00000000-0000-4000-a200-000000000006','joined')
  on conflict (plan_id, user_id) do nothing;

  -- ── 23 bulk plans, hosted by test users, spread across ~13 days ─────────
  for i in 1..23 loop
    li := 1 + (i % array_length(locs,1));
    insert into public.plans
      (id, host_id, category_id, activity, description, location_label, lat, lng,
       starts_at, capacity, spots_remaining, plan_type, status, cost, cost_note, gender_pref)
    values (
      ('00000000-0000-4000-b300-' || lpad(i::text,12,'0'))::uuid,
      ('00000000-0000-4000-a200-' || lpad(((i % 30) + 1)::text,12,'0'))::uuid,
      cats[1 + (i % array_length(cats,1))],
      acts[1 + (i % array_length(acts,1))],
      'Open to all — hop on.',
      locs[li], lats[li] + (i*0.0008), lngs[li] + (i*0.0008),
      now() + interval '6 hours' + (i * interval '13 hours'),
      (4 + (i % 5))::smallint, (3 + (i % 5))::smallint,
      (case when i % 4 = 0 then 'closed' else 'open' end)::plan_type_t,
      'active'::plan_status_t,
      costs[1 + (i % array_length(costs,1))]::cost_t,
      case when (1 + (i % array_length(costs,1))) in (2,3) then '₹120/person' else null end,
      (case when i % 7 = 0 then 'women' when i % 11 = 0 then 'men' else 'all' end)::gender_pref_t
    )
    on conflict (id) do nothing;
  end loop;

  -- Arjun pre-joined to two bulk plans (gives the Joined tab content + a
  -- ready-made leave target). b300..01 and ..03 are open/all-gender/future.
  insert into public.plan_members (plan_id, user_id, status) values
    ('00000000-0000-4000-b300-000000000001', arjun, 'joined'),
    ('00000000-0000-4000-b300-000000000003', arjun, 'joined')
  on conflict (plan_id, user_id) do nothing;

  raise notice 'seed_dev_testdata: applied 30 users + 30 plans';
end $$;
