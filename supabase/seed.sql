-- ============================================================================
-- HopOn — Local development seed data
-- Source: ported from src/mocks/* per execution doc Phase 0.
-- Applied automatically by `supabase db reset` AFTER all migrations.
-- NEVER run against production. CI guards on SUPABASE_ENV.
--
-- Strategy:
--   * Seeds run only when the schema they target exists. Until Phase 1+
--     migrations land, each section below is a no-op guarded by to_regclass().
--   * Test users map to the fixed local OTP phones in config.toml
--     (+919999999991..3) plus dev-created auth users for u3..u5.
--   * UUIDs are stable across resets so client fixtures can hardcode them.
-- ============================================================================

-- ─── Stable UUIDs for the six mock users (u0..u5) ───────────────────────────
-- u0 You       00000000-0000-4000-a000-000000000000
-- u1 Arjun R   00000000-0000-4000-a000-000000000001
-- u2 Priya K   00000000-0000-4000-a000-000000000002
-- u3 Kiran B   00000000-0000-4000-a000-000000000003
-- u4 Sneha P   00000000-0000-4000-a000-000000000004
-- u5 Dev A     00000000-0000-4000-a000-000000000005

do $$
begin
  -- ── Phase 1 guard: users table ─────────────────────────────────────────
  if to_regclass('public.users') is null then
    raise notice 'seed: users table not yet migrated — skipping (expected before Phase 1)';
    return;
  end if;

  -- auth.users shells (local only — rows exist so FKs hold).
  -- GoTrue cannot scan NULL token columns, so they must be '' for the seeded
  -- numbers to work with phone OTP (the +91999999999{1,2,3} test_otp numbers
  -- collide with u0–u2). Phones stored WITHOUT '+' (GoTrue E.164 storage);
  -- contact-hash convention is sha256('+' || phone) — see match_contact_hashes.
  insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change,
         phone_change, phone_change_token, email_change_token_current, reauthentication_token)
  select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         v.phone, now(), now(), now(),
         '', '', '', '', '', '', '', ''
  from (values
    ('00000000-0000-4000-a000-000000000000', '919999999991'),
    ('00000000-0000-4000-a000-000000000001', '919999999992'),
    ('00000000-0000-4000-a000-000000000002', '919999999993'),
    ('00000000-0000-4000-a000-000000000003', '919999999994'),
    ('00000000-0000-4000-a000-000000000004', '919999999995'),
    ('00000000-0000-4000-a000-000000000005', '919999999996')
  ) as v(id, phone)
  on conflict (id) do nothing;

  insert into public.users
    (id, name, handle, neighbourhood, bio, dob, gender, verification_level,
     plans_hosted, plans_attended, people_met, attendance_score)
  values
    ('00000000-0000-4000-a000-000000000000','You','@you','HSR Layout','Software engineer. New to HSR.','1995-01-15','man','phone',3,14,22,92),
    ('00000000-0000-4000-a000-000000000001','Arjun R','@arjun.blr','HSR Layout','Badminton most weekends.','1993-06-02','man','phone',12,28,34,98),
    ('00000000-0000-4000-a000-000000000002','Priya K','@priya_runs','Koramangala','PM by day, runner by morning.','1994-11-20','woman','phone',22,31,48,94),
    ('00000000-0000-4000-a000-000000000003','Kiran B','@kiran.b','HSR Layout','Coffee, cycling, code.','1996-03-08','man','none',9,19,24,89),
    ('00000000-0000-4000-a000-000000000004','Sneha P','@sneha.p','Indiranagar','Designer. Always hungry.','1997-09-12','woman','phone',7,16,21,88),
    ('00000000-0000-4000-a000-000000000005','Dev A','@dev.codes','Koramangala','Builder. Movie buff.','1995-12-30','man','none',5,13,18,96)
  on conflict (id) do nothing;

  -- ── Phase 2 guard: plans ───────────────────────────────────────────────
  if to_regclass('public.plans') is null then
    raise notice 'seed: plans table not yet migrated — skipping plan seeds';
    return;
  end if;

  -- A representative slice of src/mocks/plans.ts: one of each lifecycle state.
  insert into public.plans
    (id, host_id, category_id, activity, description, location_label, lat, lng,
     starts_at, capacity, spots_remaining, plan_type, status, cost, cost_note, gender_pref)
  values
    ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000002','food',
     'Coffee','Quick catch-up over coffee. Come as you are.','Third Wave, Koramangala',
     12.9352,77.6245, now() + interval '8 minutes', 5,1,'open','active','free',null,'all'),
    ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000001','sports',
     'Badminton','Need 2 more for doubles. Court booked 90 mins.','Play Arena, HSR Layout',
     12.9116,77.6370, now() + interval '25 minutes', 4,2,'closed','active','copay','₹150/person','all'),
    ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-a000-000000000004','outdoors',
     'Sunset walk','Easy evening stroll around the garden before sunset.','Lalbagh Botanical Garden',
     12.9507,77.5848, now() + interval '330 minutes', 6,3,'open','active','free',null,'women'),
    ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000000','food',
     'Coffee','Hosted a relaxed weekend coffee. Great turnout.','Blue Tokai, Koramangala',
     12.9349,77.6248, now() - interval '2 days', 3,0,'open','ended','free',null,'all')
  on conflict (id) do nothing;

  update public.plans set ended_at = starts_at + interval '2 hours'
  where id = '00000000-0000-4000-b000-000000000012' and ended_at is null;

  if to_regclass('public.plan_members') is not null then
    insert into public.plan_members (plan_id, user_id, status)
    values
      ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000003','joined'),
      ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000004','joined'),
      ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000000','joined'),
      ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000005','joined'),
      ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000002','attended'),
      ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000003','attended')
    on conflict (plan_id, user_id) do nothing;
  end if;

  -- Later-phase seeds (messages, recaps, follows, trust) are appended to this
  -- file in their respective phases, each behind its own to_regclass() guard.
end $$;
