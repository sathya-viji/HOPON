-- ============================================================================
-- Migration 0002 — enums and reference data
-- Execution doc Part 1, Migration 0002. Idempotent (duplicate_object guarded).
-- ALL enums for the full system are created here exactly as frozen, so later
-- phases never alter types — only add tables that use them.
-- ============================================================================

do $$ begin
  create type verification_level as enum ('none','phone','id');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('active','suspended','banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_t as enum ('man','woman','nonbinary','prefer_not');
exception when duplicate_object then null; end $$;

do $$ begin
  create type profile_vis as enum ('everyone','followers','nobody');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_vis as enum ('everyone','followers');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_type_t as enum ('open','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status_t as enum ('active','full','cancelled','expired','ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cost_t as enum ('free','copay','seeking','sponsored');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_pref_t as enum ('all','women','men');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status_t as enum ('joined','requested','approved','declined','attended','noshow');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_result as enum ('present','noshow');
exception when duplicate_object then null; end $$;

do $$ begin
  create type follow_status_t as enum ('pending','accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_target_t as enum ('user','plan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_reason_t as enum ('spam','harassment','fake_profile','inappropriate_content',
                                       'no_show','safety_concern','emergency','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status_t as enum ('pending','reviewed','resolved','dismissed','escalated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notif_type as enum (
    -- plan (host)
    'plan_posted','new_joiner','join_request','joiner_left','plan_full',
    'plan_starting_soon_host','plan_started_host','plan_ended_host',
    'endorse_reminder','recap_reminder','plan_cancelled_confirm',
    'host_marked_absent','new_recap_on_your_plan',
    -- plan (joiner)
    'request_approved','request_declined','plan_updated','plan_cancelled',
    'plan_starting_soon_joiner','plan_starting_15','plan_ended_joiner','marked_noshow',
    -- chat
    'mention',
    -- trust
    'endorsement_received','attendance_score_improved','attendance_score_dropped','new_familiar_face',
    -- recaps & stories
    'recap_liked','recap_commented','recap_comment_replied','new_recap_from_following','story_expiring_soon',
    -- social
    'new_follower','follow_request','follow_accepted','following_posted_plan',
    -- system
    'welcome','profile_incomplete','first_plan_nudge','contact_joined',
    'plan_expired_host','plan_expired_joiner'
  );
exception when duplicate_object then null; end $$;

-- ── Reference: categories (production reference data lives in migrations,
--    never in seed.sql) ───────────────────────────────────────────────────
create table if not exists categories (
  id         text primary key,
  label      text not null,
  icon       text not null,
  sort_order smallint not null default 0
);

insert into categories (id, label, icon, sort_order) values
  ('food',          'Food & Drink',  'coffee',       1),
  ('sports',        'Sports',        'dumbbell',     2),
  ('outdoors',      'Outdoors',      'mountain',     3),
  ('social',        'Social',        'users',        4),
  ('arts',          'Arts & Music',  'music',        5),
  ('learning',      'Learning',      'book-open',    6),
  ('entertainment', 'Entertainment', 'clapperboard', 7),
  ('other',         'Other',         'sparkles',     8)
on conflict (id) do nothing;

-- Categories are world-readable reference data.
alter table categories enable row level security;
drop policy if exists categories_read on categories;
create policy categories_read on categories for select to authenticated, anon using (true);
