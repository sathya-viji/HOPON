-- ============================================================================
-- Migration 0003 — users
-- Execution doc Part 1, Migration 0003. Idempotent.
-- gender + dob are PRIVATE (D11): never exposed through users_public (0004).
-- F1: minimum age 18 enforced at DB level.
-- No auth trigger: the profile row is created by complete_signup() after
-- onboarding collects name/dob/gender.
-- ============================================================================
create table if not exists users (
  id                 uuid primary key references auth.users on delete cascade,
  name               text not null check (char_length(name) between 1 and 60),
  handle             text not null unique check (handle ~ '^@[a-z0-9_.]{2,30}$'),
  avatar_path        text,
  neighbourhood      text not null,
  bio                text check (char_length(bio) <= 280),
  dob                date not null check (dob <= current_date - interval '18 years'),
  gender             gender_t not null,
  verification_level verification_level not null default 'phone',
  account_status     account_status not null default 'active',
  suspended_until    timestamptz,
  suspension_reason  text,
  profile_visibility profile_vis not null default 'everyone',
  plan_visibility    plan_vis not null default 'everyone',
  ig_handle          text,
  linkedin_handle    text,
  fb_handle          text,
  plans_hosted       integer not null default 0,
  plans_attended     integer not null default 0,
  people_met         integer not null default 0,
  attendance_score   smallint check (attendance_score between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists users_name_trgm  on users using gin (name extensions.gin_trgm_ops);
create index if not exists users_handle_pat on users (handle text_pattern_ops);

-- updated_at maintenance
create or replace function fn_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_users_touch on users;
create trigger trg_users_touch before update on users
  for each row execute function fn_touch_updated_at();
