# HopOn — Backend Execution Document

**Version:** 1.0 FINAL · **Date:** 2026-06-13 · **Status:** ARCHITECTURE FROZEN
**Change policy:** No changes unless a blocking issue is discovered during implementation.

---

# Part 0 — Frozen Decision Register (Cross-Checked)

Every decision made across all sessions, verified for consistency:

| # | Decision | Value | Verified in this doc |
|---|---|---|---|
| D1 | Verified badge | `verification_level` enum: none / phone / id | §1 users |
| D2 | Story TTL | 24 hours | §1 stories, §6 cron |
| D3 | Chat persistence | Permanent; read-only 30 days after `ended_at` | §3 messages RLS |
| D4 | Attendance score | present/(present+noshow), null until 3 events | §4 compute_attendance_score |
| D5 | Host in trust graph | Synthetic plan_members row at end_plan | §4 end_plan |
| D6 | Peer endorsements | Enabled; 1 tag per giver→receiver per plan; present-only | §1 endorsements |
| D7 | Host no-show | Quorum: 3+ votes OR ≥50% of present attendees; 48h window | §1 host_noshow_votes, §4 |
| D8 | Plan advance window | Max 14 days | §1 plans CHECK |
| D9 | Sponsored plans | cost='sponsored', no business accounts | §1 plans |
| D10 | Contact hashes | Retained; SHA-256 only, hashed client-side | §1 contact_hashes |
| D11 | Gender | Private; strict server-side enforcement (woman→women, man→men); nonbinary/prefer_not cannot join gendered plans | §3 users_public, §4 join_plan |
| D12 | Recap privacy | Public by default | §3 recaps RLS |
| D13 | Follow graph | First-class: recap feed, story feed, future activity feed; feed_events stub | §1 feed_events |
| DA | Familiar faces threshold | 1 plan together | §4 rebuild_familiar_faces |
| DB | Endorsement display | Top 5 tags with counts | §4 profile query |
| S1 | follow notifications | `new_follower` (accepted-direct), `follow_request` (pending), `follow_accepted` (pending→accepted) | §1 notif enum |
| S2 | All post-plan windows | 48h (host endorse, peer endorse, host-noshow vote) | §4 |
| S3 | end_plan order | host member row → host attendance mark → open windows | §4 end_plan |
| F1 | Minimum age | 18 — DB CHECK + client validation | §1 users CHECK |
| F2 | Image moderation | Google Vision SafeSearch on all uploads | §5 image-moderator |
| F3 | Deletion model | Hybrid: hard-delete personal content, anonymise trust-graph contributions, 30-day grace | §4 delete_account, §7 cron |
| F4 | Emergency reports | New reason `emergency` with immediate escalation | §1 reports, §5 |
| F5 | Audit logs | `audit_logs` table for all admin + system trust actions | §1 audit_logs |
| — | Region | Supabase ap-south-1 (Mumbai) | §8 |
| — | SMS | Twilio via Supabase Auth | §8 |
| — | Push | Expo Push (EPNS) | §5 push-sender |
| — | Analytics | PostHog | §8 |
| — | Crash | Sentry | §8 |
| — | Notification types | 38 types + `follow_request` = full enum in §1 | §1 |

**Cross-check corrections applied while compiling this document:**
1. The original 7-type notification enum is superseded by the 38-type taxonomy — schema below uses the full list (39 including `follow_request`).
2. `endorsements` host-only trigger replaced with present-attendee trigger (D6).
3. `is_verified boolean` replaced with `verification_level` (D1).
4. `reports.reason` gains `'emergency'` (F4).
5. `users` gains `account_status`, `dob` age CHECK (F1, moderation).
6. `plan_members` gains `idempotency_key` (offline resilience).
7. `audit_logs`, `pending_jobs`, `feature_flags`, `invites`, `host_noshow_votes`, `feed_events` added as first-class tables.
8. Host synthetic member row uses status `'attended'`; `MemberStatus` type extended with `'noshow'` vs. frontend type — **frontend `src/types/plan.ts` must add `'noshow'`**.

---

# Part 1 — Final Schema (Migration Order)

Migrations live in `/supabase/migrations/`, one file per numbered step. Names below are the actual filenames.

## Migration 0001 — `extensions.sql`
```sql
create extension if not exists pg_trgm;
create extension if not exists postgis;      -- geo for multi-city future; v1 uses point ops
create extension if not exists pg_cron;
create extension if not exists pg_net;       -- webhooks from triggers
```

## Migration 0002 — `enums_and_reference.sql`
```sql
create type verification_level as enum ('none','phone','id');
create type account_status     as enum ('active','suspended','banned');
create type gender_t           as enum ('man','woman','nonbinary','prefer_not');
create type profile_vis        as enum ('everyone','followers','nobody');
create type plan_vis           as enum ('everyone','followers');
create type plan_type_t        as enum ('open','closed');
create type plan_status_t      as enum ('active','full','cancelled','expired','ended');
create type cost_t             as enum ('free','copay','seeking','sponsored');
create type gender_pref_t      as enum ('all','women','men');
create type member_status_t    as enum ('joined','requested','approved','declined','attended','noshow');
create type attendance_result  as enum ('present','noshow');
create type follow_status_t    as enum ('pending','accepted');
create type report_target_t    as enum ('user','plan');
create type report_reason_t    as enum ('spam','harassment','fake_profile','inappropriate_content',
                                        'no_show','safety_concern','emergency','other');
create type report_status_t    as enum ('pending','reviewed','resolved','dismissed','escalated');

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

create table categories (
  id         text primary key,
  label      text not null,
  icon       text not null,
  sort_order smallint not null default 0
);
insert into categories (id,label,icon,sort_order) values
 ('food','Food & Drink','coffee',1),('sports','Sports','dumbbell',2),
 ('outdoors','Outdoors','mountain',3),('social','Social','users',4),
 ('arts','Arts & Music','music',5),('learning','Learning','book-open',6),
 ('entertainment','Entertainment','clapperboard',7),('other','Other','sparkles',8);
```

## Migration 0003 — `users.sql`
```sql
create table users (
  id                 uuid primary key references auth.users on delete cascade,
  name               text not null check (char_length(name) between 1 and 60),
  handle             text not null unique check (handle ~ '^@[a-z0-9_.]{2,30}$'),
  avatar_path        text,
  neighbourhood      text not null,
  bio                text check (char_length(bio) <= 280),
  dob                date not null check (dob <= current_date - interval '18 years'),  -- F1
  gender             gender_t not null,                       -- PRIVATE: never in users_public
  verification_level verification_level not null default 'phone',   -- D1: OTP signup = phone
  account_status     account_status not null default 'active',
  suspended_until    timestamptz,
  suspension_reason  text,
  profile_visibility profile_vis not null default 'everyone',
  plan_visibility    plan_vis not null default 'everyone',
  ig_handle          text, linkedin_handle text, fb_handle text,
  plans_hosted       integer not null default 0,
  plans_attended     integer not null default 0,
  people_met         integer not null default 0,
  attendance_score   smallint check (attendance_score between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index users_name_trgm on users using gin (name gin_trgm_ops);
create index users_handle_pat on users (handle text_pattern_ops);

-- auto-create profile shell on auth signup is NOT used: profile is created by
-- complete_signup RPC after onboarding collects name/dob/gender. auth.users row
-- exists alone until then.
```

## Migration 0004 — `users_public_view.sql`
```sql
-- D11: gender and dob are NEVER exposed. Clients query users_public only.
create view users_public with (security_invoker = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         plans_hosted, plans_attended, people_met, attendance_score,
         created_at
  from users
  where deleted_at is null and account_status <> 'banned';

revoke select on users from anon, authenticated;
grant  select on users_public to authenticated;
grant  update (name, avatar_path, neighbourhood, bio, profile_visibility,
               plan_visibility, ig_handle, linkedin_handle, fb_handle)
       on users to authenticated;
```

## Migration 0005 — `plans.sql`
```sql
create table plans (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references users(id),
  category_id     text not null references categories(id),
  activity        text not null check (char_length(activity) between 1 and 60),
  description     text check (char_length(description) <= 500),
  rules           text check (char_length(rules) <= 140),
  location_label  text not null,
  lat             numeric(9,6) not null,
  lng             numeric(9,6) not null,
  starts_at       timestamptz not null,
  capacity        smallint not null check (capacity between 2 and 10),
  spots_remaining smallint not null check (spots_remaining >= 0),
  plan_type       plan_type_t not null default 'open',
  status          plan_status_t not null default 'active',
  cost            cost_t not null default 'free',
  cost_note       text check (char_length(cost_note) <= 80),
  gender_pref     gender_pref_t not null default 'all',
  is_hidden       boolean not null default false,   -- moderation auto-hide
  search_vector   tsvector generated always as
                    (to_tsvector('english', activity || ' ' ||
                     coalesce(description,'') || ' ' || location_label)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  ended_at        timestamptz,
  cancelled_at    timestamptz,
  constraint plans_advance_window check (starts_at <= created_at + interval '14 days')  -- D8
);
create index plans_geo        on plans using gist (point(lng, lat));
create index plans_starts_at  on plans (starts_at) where status = 'active';
create index plans_status     on plans (status);
create index plans_host       on plans (host_id);
create index plans_category   on plans (category_id);
create index plans_search     on plans using gin (search_vector);
```

## Migration 0006 — `plan_members.sql`
```sql
create table plan_members (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  status          member_status_t not null default 'joined',
  is_host_row     boolean not null default false,   -- D5 synthetic host row
  idempotency_key uuid unique,                       -- retry-safe joins
  joined_at       timestamptz not null default now(),
  resolved_at     timestamptz,
  unique (plan_id, user_id)
);
create index plan_members_plan on plan_members (plan_id, status);
create index plan_members_user on plan_members (user_id, status);

-- host cannot join own plan EXCEPT via the synthetic host row
create or replace function fn_block_host_self_join() returns trigger
language plpgsql as $$
begin
  if not new.is_host_row and exists
     (select 1 from plans where id = new.plan_id and host_id = new.user_id) then
    raise exception 'host_cannot_join_own_plan';
  end if;
  return new;
end $$;
create trigger trg_block_host_self_join before insert on plan_members
  for each row execute function fn_block_host_self_join();

-- maintain plans.spots_remaining (counts joined/approved only)
create or replace function fn_sync_spots() returns trigger
language plpgsql as $$
declare pid uuid := coalesce(new.plan_id, old.plan_id);
begin
  update plans p set spots_remaining = greatest(0, p.capacity - 1 - (
    select count(*) from plan_members m
    where m.plan_id = pid and m.status in ('joined','approved') and not m.is_host_row
  )),
  status = case
    when p.status = 'active' and p.capacity - 1 - (
      select count(*) from plan_members m
      where m.plan_id = pid and m.status in ('joined','approved') and not m.is_host_row
    ) <= 0 then 'full'
    when p.status = 'full' and p.capacity - 1 - (
      select count(*) from plan_members m
      where m.plan_id = pid and m.status in ('joined','approved') and not m.is_host_row
    ) > 0 then 'active'
    else p.status end
  where p.id = pid;
  return coalesce(new, old);
end $$;
create trigger trg_sync_spots after insert or update of status or delete on plan_members
  for each row execute function fn_sync_spots();
```
> Capacity convention: `capacity` includes the host (matches "Including you" in CreateScreen), so joinable spots = `capacity - 1`.

## Migration 0007 — `messages.sql`
```sql
create table messages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  author_id  uuid not null references users(id),
  body       text not null check (char_length(body) between 1 and 1000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_plan_time on messages (plan_id, created_at);

-- D3: block sends on cancelled/expired plans and 30 days after ended_at
create or replace function fn_chat_lock() returns trigger
language plpgsql as $$
declare p plans;
begin
  select * into p from plans where id = new.plan_id;
  if p.status in ('cancelled','expired') then raise exception 'chat_closed'; end if;
  if p.ended_at is not null and now() > p.ended_at + interval '30 days' then
    raise exception 'chat_archived';
  end if;
  return new;
end $$;
create trigger trg_chat_lock before insert on messages
  for each row execute function fn_chat_lock();
```

## Migration 0008 — `trust.sql`
```sql
create table attendance_marks (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id),
  marked_by  uuid not null references users(id),
  subject_id uuid not null references users(id),
  result     attendance_result not null,
  created_at timestamptz not null default now(),
  unique (plan_id, subject_id)
);
create index att_marks_plan    on attendance_marks (plan_id);
create index att_marks_subject on attendance_marks (subject_id);

-- D6: peer endorsements. One tag per giver→receiver per plan.
create table endorsements (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id),
  giver_id    uuid not null references users(id),
  receiver_id uuid not null references users(id),
  tag         text not null check (char_length(tag) between 1 and 50),
  created_at  timestamptz not null default now(),
  unique (plan_id, giver_id, receiver_id),
  check (giver_id <> receiver_id)
);
create index endorsements_recv on endorsements (receiver_id, tag);

-- both parties must be marked present; 48h window (S2)
create or replace function fn_endorsement_guard() returns trigger
language plpgsql as $$
declare p plans;
begin
  select * into p from plans where id = new.plan_id;
  if p.ended_at is null or now() > p.ended_at + interval '48 hours' then
    raise exception 'endorsement_window_closed';
  end if;
  if not exists (select 1 from attendance_marks where plan_id = new.plan_id
                 and subject_id = new.giver_id and result = 'present') then
    raise exception 'giver_not_present';
  end if;
  if not exists (select 1 from attendance_marks where plan_id = new.plan_id
                 and subject_id = new.receiver_id and result = 'present') then
    raise exception 'receiver_not_present';
  end if;
  return new;
end $$;
create trigger trg_endorsement_guard before insert on endorsements
  for each row execute function fn_endorsement_guard();

-- D7: host no-show quorum votes
create table host_noshow_votes (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id),
  voter_id   uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (plan_id, voter_id)
);

-- DA: familiar faces, canonical pair ordering
create table familiar_faces (
  user_a_id      uuid not null references users(id) on delete cascade,
  user_b_id      uuid not null references users(id) on delete cascade,
  plans_together smallint not null default 1,
  last_met_at    timestamptz not null,
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);
create index ff_a on familiar_faces (user_a_id);
create index ff_b on familiar_faces (user_b_id);
```

## Migration 0009 — `social.sql`
```sql
create table recaps (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id),
  author_id     uuid not null references users(id) on delete cascade,
  image_path    text not null,
  caption       text check (char_length(caption) <= 280),
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  moderation    text not null default 'pending' check (moderation in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);
create index recaps_plan   on recaps (plan_id, created_at desc);
create index recaps_author on recaps (author_id, created_at desc);

create table recap_likes (
  recap_id   uuid not null references recaps(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recap_id, user_id)
);

create table recap_comments (
  id         uuid primary key default gen_random_uuid(),
  recap_id   uuid not null references recaps(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index recap_comments_recap on recap_comments (recap_id, created_at);

-- counter triggers
create or replace function fn_recap_like_count() returns trigger language plpgsql as $$
begin
  update recaps set like_count = like_count + (case when tg_op='INSERT' then 1 else -1 end)
  where id = coalesce(new.recap_id, old.recap_id);
  return coalesce(new, old);
end $$;
create trigger trg_recap_like_count after insert or delete on recap_likes
  for each row execute function fn_recap_like_count();

create or replace function fn_recap_comment_count() returns trigger language plpgsql as $$
begin
  update recaps set comment_count = comment_count + (case when tg_op='INSERT' then 1 else -1 end)
  where id = coalesce(new.recap_id, old.recap_id);
  return coalesce(new, old);
end $$;
create trigger trg_recap_comment_count after insert or delete on recap_comments
  for each row execute function fn_recap_comment_count();

-- D2: 24h stories
create table stories (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references users(id) on delete cascade,
  plan_id    uuid references plans(id),
  plan_label text,
  image_path text not null,
  caption    text check (char_length(caption) <= 140),
  moderation text not null default 'pending' check (moderation in ('pending','approved','rejected')),
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create index stories_author  on stories (author_id, expires_at desc);
create index stories_expires on stories (expires_at);

create table story_views (
  story_id  uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  status       follow_status_t not null default 'accepted',
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following on follows (following_id, status);
create index follows_follower  on follows (follower_id, status);

-- D13: feed_events stub — table exists, fan-out NOT implemented at v1
create table feed_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references users(id) on delete cascade,
  event_type text not null,
  object_id  uuid not null,
  created_at timestamptz not null default now()
);
create index feed_events_actor on feed_events (actor_id, created_at desc);
```

## Migration 0010 — `safety.sql`
```sql
create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocker on blocks (blocker_id);
create index blocks_blocked on blocks (blocked_id);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_type report_target_t not null,
  target_id   uuid not null,
  reason      report_reason_t not null,
  notes       text check (char_length(notes) <= 500),
  status      report_status_t not null default 'pending',
  created_at  timestamptz not null default now()
);
create index reports_status on reports (status, created_at);
create index reports_target on reports (target_type, target_id);

-- F4: emergency reports escalate instantly
create or replace function fn_report_escalation() returns trigger
language plpgsql as $$
begin
  if new.reason = 'emergency' then
    new.status := 'escalated';
    -- pg_net webhook to Edge Function 'emergency-escalation' (configured post-deploy)
    perform net.http_post(
      url := current_setting('app.edge_base_url') || '/emergency-escalation',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_key'), 'Content-Type','application/json'),
      body := jsonb_build_object('report_id', new.id, 'target_type', new.target_type, 'target_id', new.target_id)
    );
  end if;
  return new;
end $$;
create trigger trg_report_escalation before insert on reports
  for each row execute function fn_report_escalation();

-- F5: audit logs — service-role writes only, no client access
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_type  text not null check (actor_type in ('admin','system','user')),
  actor_id    uuid,                         -- null for system
  action      text not null,                -- 'suspend_user','resolve_report','host_noshow_resolved',
                                            -- 'account_deleted','image_rejected','score_recomputed', ...
  target_type text not null,
  target_id   uuid,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_logs_target on audit_logs (target_type, target_id, created_at desc);
create index audit_logs_action on audit_logs (action, created_at desc);
```

## Migration 0011 — `notifications.sql`
```sql
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       notif_type not null,
  is_read    boolean not null default false,
  plan_id    uuid references plans(id) on delete set null,
  actor_id   uuid references users(id) on delete set null,
  recap_id   uuid references recaps(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index notifs_user_time   on notifications (user_id, created_at desc);
create index notifs_user_unread on notifications (user_id, created_at desc) where is_read = false;

create table notification_prefs (
  user_id      uuid not null references users(id) on delete cascade,
  event_type   notif_type not null,
  push_enabled boolean not null default true,
  primary key (user_id, event_type)
);
-- Non-configurable types (always pushed, prefs row ignored):
-- request_approved, request_declined, plan_cancelled, host_marked_absent, marked_noshow, welcome

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index push_tokens_user on push_tokens (user_id);
```

## Migration 0012 — `growth_and_ops.sql`
```sql
create table contact_hashes (              -- D10
  owner_id   uuid not null references users(id) on delete cascade,
  phone_hash text not null,                -- SHA-256(E.164), hashed client-side
  created_at timestamptz not null default now(),
  primary key (owner_id, phone_hash)
);
create index contact_hashes_hash on contact_hashes (phone_hash);

create table invites (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid not null references users(id) on delete cascade,
  phone_hash   text not null,
  status       text not null default 'pending' check (status in ('pending','joined')),
  created_at   timestamptz not null default now(),
  converted_at timestamptz
);
create index invites_hash on invites (phone_hash) where status = 'pending';

create table feature_flags (
  flag_name   text primary key,
  enabled     boolean not null default false,
  rollout_pct smallint not null default 100 check (rollout_pct between 0 and 100),
  description text
);

create table pending_jobs (                -- Edge Function retry queue
  id         uuid primary key default gen_random_uuid(),
  job_type   text not null,
  payload    jsonb not null,
  attempts   smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  next_retry timestamptz not null default now()
);
create index pending_jobs_retry on pending_jobs (next_retry) where attempts < 4;

create table recap_like_batches (          -- batched like-push state
  recap_id     uuid primary key references recaps(id) on delete cascade,
  unsent_count integer not null default 0,
  last_sent_at timestamptz
);

create table user_counters_daily (         -- rate limiting
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null default current_date,
  counter    text not null,                -- 'reports','plan_cancels', ...
  count      integer not null default 0,
  primary key (user_id, day, counter)
);
```

## Migration 0013 — `rls.sql` → Part 3
## Migration 0014 — `rpc.sql` → Part 4
## Migration 0015 — `cron.sql` → Part 6
## Migration 0016 — `storage_buckets.sql` → Part 5 (bucket policies)

---

# Part 2 — Storage Buckets

| Bucket | Public read | Write policy | Moderation |
|---|---|---|---|
| `avatars` | yes | own prefix `avatars/{auth.uid()}/...`, ≤5MB, image/* | Vision SafeSearch |
| `recaps` | yes | own prefix, ≤10MB, image/* | Vision SafeSearch |
| `stories` | yes | own prefix, ≤10MB, image/* | Vision SafeSearch |

Upload flow: client compresses (expo-image-manipulator) → uploads to own prefix → calls the relevant RPC/Edge Function with the storage path → `image-moderator` validates → DB row's `moderation` flips to `approved` or row deleted + object removed + `image_rejected` audit log.

---

# Part 3 — RLS Policy Matrix

RLS enabled on **every** table. `audit_logs`, `pending_jobs`, `contact_hashes`, `recap_like_batches`, `user_counters_daily`, `feed_events` have **no client policies at all** (service-role only). Reusable helper:

```sql
create or replace function is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer as $$
  select exists (select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function is_active_member(p uuid, u uuid) returns boolean
language sql stable security definer as $$
  select exists (select 1 from plan_members
    where plan_id = p and user_id = u and status in ('joined','approved','attended'))
  or exists (select 1 from plans where id = p and host_id = u);
$$;
```

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| users (base) | revoked from clients — view only | via `complete_signup` RPC | own row, whitelisted columns | never (RPC soft-delete) |
| users_public | all authenticated, visibility+block filtered (view WHERE) | — | — | — |
| plans | host always; others: not hidden, not blocked-pair with host, host plan_visibility respected, host account active | `host_id = auth.uid()` AND account active (via RPC) | host only; not after ended/cancelled | never (status change only) |
| plan_members | own row; or host of plan | via `join_plan` RPC only (`with check user_id = auth.uid() and not is_host_row`) | host only (approve/decline via RPC) | own row (leave) while plan active |
| messages | `is_active_member(plan_id, auth.uid())` | same + `author_id = auth.uid()` (+ chat-lock trigger) | own row → `is_deleted` only | never |
| recaps | `moderation='approved'` AND not blocked-pair (D12 public) — author sees own pending | `author_id = auth.uid()` AND participant of plan AND `created_at >= plans.starts_at` | own caption | own row |
| recap_likes | visible where recap visible | `user_id = auth.uid()` | — | own row |
| recap_comments | visible where recap visible | `author_id = auth.uid()` | own → is_deleted | never |
| stories | `expires_at > now()` AND `moderation='approved'` AND (everyone, or follower if author profile is followers-only) AND not blocked | `author_id = auth.uid()` | — | own row |
| story_views | author of story (viewer list) or own row | `viewer_id = auth.uid()` | — | — |
| follows | rows where user is follower or followee | `follower_id = auth.uid()`, not blocked-pair; status forced by RPC based on target's profile_visibility | followee may accept pending (status→accepted) | own follower row (unfollow) or followee row (remove/decline) |
| blocks | own (blocker) | `blocker_id = auth.uid()` | — | own |
| reports | none (write-only for clients) | `reporter_id = auth.uid()` (rate-limited in RPC) | — | — |
| attendance_marks | giver or subject | via `submit_endorsements` RPC; trigger enforces host-of-plan for non-host subjects | — | — |
| endorsements | giver or receiver; aggregated counts via `get_endorsement_summary` RPC for any visible profile | `giver_id = auth.uid()` (+ present-guard trigger) | — | — |
| host_noshow_votes | own row | `voter_id = auth.uid()` AND voter marked present AND within 48h of starts_at AND not the host | — | — |
| familiar_faces | rows containing auth.uid() | system only | system only | system only |
| notifications | own | system only | own → `is_read` | own |
| notification_prefs | own | own | own | own |
| push_tokens | own | via RPC | via RPC | own |
| feature_flags | all authenticated (read) | — | — | — |
| invites | own (inviter) | `inviter_id = auth.uid()` | — | — |

---

# Part 4 — RPC Functions (Postgres, `security definer`)

All RPCs: `security definer`, `set search_path = public`, raise typed exceptions (`gender_mismatch`, `plan_full`, `rate_limited`, …) that map to client error codes.

### 4.1 `complete_signup(p_name, p_handle, p_dob, p_gender, p_neighbourhood) → users_public row`
Creates the `users` row for `auth.uid()` after onboarding. Validates age ≥ 18 (CHECK is backstop), handle uniqueness, then seeds `notification_prefs` defaults and fires `welcome` notification.

### 4.2 `join_plan(p_plan_id uuid, p_idempotency_key uuid) → plan_members row`
1. `SELECT ... FOR UPDATE` on plan row (race-safe spot decrement).
2. Validate: status `active`; `spots_remaining > 0` (for open); caller not host; caller account `active`; not blocked-pair with host; `starts_at > now()`.
3. **D11 gender enforcement:** `gender_pref='women'` requires caller `gender='woman'`; `'men'` requires `'man'`; else `gender_mismatch`.
4. Rate limit: ≤20 joins/hour (`user_counters_daily`).
5. Idempotency: if `p_idempotency_key` exists, return existing row.
6. Insert with status `joined` (open) or `requested` (closed).
7. Notify: `new_joiner` or `join_request` to host; `plan_full` if spots hit 0.

### 4.3 `leave_plan(p_plan_id) → void`
Deletes own member row (trigger restores spot). Notifies host `joiner_left`. Blocked if plan ended.

### 4.4 `approve_request(p_plan_id, p_user_id)` / `decline_request(...)`
Host-only. `FOR UPDATE` on plan; approve fails with `plan_full` if no spots. Sets status + `resolved_at`. Notifies `request_approved` / `request_declined`.

### 4.5 `update_plan(p_plan_id, ...fields)`
Host-only, only while `active`/`full`, re-validates 14-day window if `starts_at` changes. Notifies all active members `plan_updated` when activity/location/starts_at change.

### 4.6 `cancel_plan(p_plan_id)`
Host-only. Status→`cancelled`, `cancelled_at=now()`. Notifies members `plan_cancelled`, host `plan_cancelled_confirm`. Increments `plan_cancels` counter; ≥3 in 24h ⇒ audit_log `cancel_spam_flag`.

### 4.7 `end_plan(p_plan_id)` — **S3 frozen order**
Host-only (cron fallback expires un-ended plans). Status→`ended`, `ended_at=now()`, then **in order**:
1. Insert host synthetic `plan_members` row (`is_host_row=true, status='attended'`).
2. Insert host `attendance_marks` (`result='present'`, `marked_by=host`).
3. Notify `plan_ended_host` + `plan_ended_joiner`. Endorse/recap reminders handled by cron. Windows (48h endorse, 48h noshow-vote) are derived from `ended_at`/`starts_at` — nothing to "open" explicitly.
4. Increment `users.plans_hosted`.

### 4.8 `submit_endorsements(p_plan_id, p_marks jsonb)` 
`p_marks = [{subject_id, result, tag?}]`.
- **Host call:** inserts `attendance_marks` for every non-host member (host-only privilege), within 48h of `ended_at`. For each `present` subject: optional `tag` ⇒ endorsement row. Updates member status → `attended`/`noshow`; fires `marked_noshow`; bumps `plans_attended`; calls `compute_attendance_score` per subject; calls `rebuild_familiar_faces`; batches `endorsement_received`.
- **Peer call (D6):** caller must already be marked present; may only submit `tag` entries (no attendance authority); one endorsement per receiver enforced by unique constraint.

### 4.9 `vote_host_noshow(p_plan_id)`
Caller must be marked present, not host, within 48h of `starts_at`. Inserts vote, then resolves quorum inline: `votes >= 3 OR votes >= ceil(0.5 * present_count_excl_host)` ⇒ update host rows (member status & attendance mark → `noshow`), recompute host score, notify `host_marked_absent`, write audit_log `host_noshow_resolved`. Idempotent: already-resolved plans ignore further votes.

### 4.10 `compute_attendance_score(p_user_id)` — **D4**
```
present := count(result='present' for subject);  noshow := count(result='noshow');
score   := null if present + noshow < 3 else round(100.0 * present / (present + noshow));
```
Updates `users.attendance_score`; fires `attendance_score_improved`/`_dropped` on change; audit_log `score_recomputed`.

### 4.11 `rebuild_familiar_faces(p_plan_id)` — **DA, includes host (D5)**
Pairwise upsert over ALL present-marked subjects on the plan (host included via its mark):
`ON CONFLICT plans_together+1, last_met_at=now()`. New pairs fire `new_familiar_face` to both and bump `people_met` for both.

### 4.12 `follow_user(p_user_id)` / `accept_follow(p_follower_id)` / `unfollow(p_user_id)`
Status `pending` if target `profile_visibility='followers'|'nobody'... wait — `nobody` profiles are unfollowable; `pending` only for `followers`. Notifies `new_follower` (direct accept), `follow_request` (pending), `follow_accepted` (on accept) — **S1**.

### 4.13 `post_recap(p_plan_id, p_image_path, p_caption)`
Participant-only, `now() >= plans.starts_at`, ≤3 recaps per plan per user. Row created `moderation='pending'`; webhook fires `image-moderator`. On approval: notify host `new_recap_on_your_plan` + followers `new_recap_from_following`.

### 4.14 `post_story(p_image_path, p_caption, p_plan_id?)` — 24h expiry default (D2), moderation pending.

### 4.15 `submit_report(p_target_type, p_target_id, p_reason, p_notes)` — ≤10/day. Emergency escalation handled by trigger (F4). Auto-moderation thresholds checked here: 3+ `safety_concern`/7d on a user ⇒ suspend + audit_log; 5+ reports on a plan ⇒ `is_hidden=true` + audit_log.

### 4.16 `block_user` / `unblock_user` — insert/delete block; block also removes follows both directions.

### 4.17 `delete_account()` — **F3 hybrid model**
Sets `users.deleted_at = now()`, `account_status='suspended'`; cancels hosted active plans (notifying members); deletes push_tokens + contact_hashes immediately; audit_log `account_delete_requested`. Hard-delete + anonymisation at +30 days by cron (Part 6): recaps/stories/likes hard-deleted; messages body→`[deleted]`; endorsements & attendance_marks preserved with anonymised actor; familiar_faces rows deleted; auth.users deleted.

### 4.18 `export_my_data() → jsonb` — PDPB export of all user-owned rows.

### 4.19 `get_endorsement_summary(p_user_id) → setof (tag, count)` — **DB**: `GROUP BY tag ORDER BY count DESC LIMIT 5`.

### 4.20 `get_home_feed(p_lat, p_lng, p_radius_km, p_filters jsonb, p_cursor)` — active+full plans, geo-ordered, visibility/block/hidden filtered, joiner avatars + familiar-face counts batched in.

### 4.21 `search_plans(p_query, ...)` / `search_users(p_query)` — tsvector + trigram per Part 1 indexes.

### 4.22 `mark_notifications_read(p_ids uuid[])`, `register_push_token(p_token, p_platform)`, `record_story_view(p_story_id)` — trivial helpers.

**Notification creation helper** (used by all of the above):
```sql
create or replace function notify(p_user uuid, p_type notif_type, p_body text,
  p_plan uuid default null, p_actor uuid default null, p_recap uuid default null)
returns void language plpgsql security definer as $$
begin
  if exists (select 1 from users where id = p_user and deleted_at is null and account_status='active') then
    insert into notifications (user_id, type, body, plan_id, actor_id, recap_id)
    values (p_user, p_type, p_body, p_plan, p_actor, p_recap);
  end if;
end $$;
```
A single Database Webhook on `notifications INSERT` → Edge Function `push-sender`.

---

# Part 5 — Edge Functions (Deno, `/supabase/functions/`)

| Function | Trigger | Responsibility |
|---|---|---|
| `push-sender` | DB webhook: `notifications` INSERT | Read prefs (skip if disabled & configurable), read push_tokens, render copy (Part 8 copy table from notification doc), batch to Expo Push API (≤100/req), prune `DeviceNotRegistered` tokens, log failures → `pending_jobs` |
| `chat-push` | DB webhook: `messages` INSERT | Push-only (no notifications row) to active members except author, when backgrounded; detect `@handle` mentions ⇒ `notify(..., 'mention')` |
| `image-moderator` | Storage webhook (avatars/recaps/stories) | Google Vision SafeSearch; reject if adult ≥ LIKELY or violence ≥ VERY_LIKELY ⇒ delete object + row, audit_log `image_rejected`; else flip `moderation='approved'` and trigger downstream notifs for recaps |
| `emergency-escalation` | pg_net from `trg_report_escalation` | F4: page founder (email + SMS via Twilio), snapshot target data into audit_logs, auto-hide target plan if `target_type='plan'` |
| `contacts-match` | Client call (onboarding + periodic) | Receive client-side SHA-256 hashes, store in `contact_hashes`, match against users + invites, fire `contact_joined`, return matched users_public rows |
| `lifecycle-cron` | Scheduled (Part 6 dispatch) | All timed notifications + plan expiry + endorse/recap reminders |
| `cleanup-cron` | Scheduled | Story expiry (+ storage object delete), stale push tokens (90d), pending_jobs retries (backoff 1m/5m/30m → dead-letter), 30-day account hard-delete (F3) |
| `like-batch-cron` | Scheduled hourly | `recap_like_batches` with `unsent_count ≥ 10` ⇒ one `recap_liked` notification each, reset counter |
| `fanout-followers` | Invoked by `create_plan` RPC via pg_net | `following_posted_plan` to all accepted followers (Edge-side to keep RPC fast); ≥1000 followers ⇒ log scaling flag |
| `delete-account-export` | Client call | Streams `export_my_data()` JSON as a download |

Secrets (Supabase secrets store): `GOOGLE_VISION_KEY`, `EXPO_ACCESS_TOKEN`, `TWILIO_*`, `FOUNDER_ALERT_PHONE`, `SERVICE_ROLE_KEY`.

---

# Part 6 — Cron Schedule (pg_cron → `lifecycle-cron`/`cleanup-cron` via pg_net)

| Job | Schedule | Action |
|---|---|---|
| plan-starting-60 | `*/5 * * * *` | `plan_starting_soon_host` / `_joiner` for plans starting in 55–65 min (dedupe via notifications existence check) |
| plan-starting-15 | `*/2 * * * *` | `plan_starting_15` for 13–17 min |
| plan-started-5 | `*/5 * * * *` | `plan_started_host` for started 3–7 min ago, still active |
| plan-expiry | `*/10 * * * *` | active & `starts_at < now()-10min` ⇒ `expired`; notify `plan_expired_host`/`_joiner`. (Plans the host never ends also expire here — host can still call `end_plan` within 48h of `starts_at` to recover the trust flow; after that the plan stays expired and no trust events occur.) |
| endorse-reminder | `*/15 * * * *` | ended 60–75 min ago ⇒ `endorse_reminder` to host + present members |
| recap-reminder | `*/15 * * * *` | ended 180–195 min ago ⇒ `recap_reminder` (skip users who already posted) |
| story-expiring | `*/30 * * * *` | `story_expiring_soon` for stories expiring in 90–150 min |
| story-cleanup | `0 * * * *` | delete expired stories + storage objects |
| like-batch | `0 * * * *` | batched `recap_liked` pushes |
| onboarding-nudges | `0 9 * * *` IST | `profile_incomplete` (48h, no avatar/bio) |
| first-plan-nudge | `0 10 * * *` IST | `first_plan_nudge` (72h, no plan activity) |
| token-prune | `0 3 * * *` | delete push_tokens `last_seen < now()-90d` |
| job-retry | `* * * * *` | retry `pending_jobs` due rows |
| account-hard-delete | `0 2 * * *` | F3: users `deleted_at < now()-30d` ⇒ anonymise + hard-delete + audit_log |
| suspension-expiry | `0 * * * *` | `suspended_until < now()` ⇒ reactivate |

---

# Part 7 — TypeScript Types (`src/types/api.ts` — replaces mock-era types at integration)

```ts
// ── enums (mirror Postgres) ──────────────────────────────────────────────
export type VerificationLevel = 'none' | 'phone' | 'id';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type CostType = 'free' | 'copay' | 'sponsored' | 'seeking';
export type GenderPref = 'all' | 'women' | 'men';
export type PlanType = 'open' | 'closed';
export type PlanStatus = 'active' | 'full' | 'cancelled' | 'expired' | 'ended';
export type MemberStatus = 'joined' | 'requested' | 'approved' | 'declined' | 'attended' | 'noshow'; // ← adds 'noshow' vs current frontend type
export type AttendanceResult = 'present' | 'noshow';
export type FollowStatus = 'pending' | 'accepted';
export type ReportTargetType = 'user' | 'plan';
export type ReportReason = 'spam' | 'harassment' | 'fake_profile' | 'inappropriate_content'
  | 'no_show' | 'safety_concern' | 'emergency' | 'other';
export type ModerationState = 'pending' | 'approved' | 'rejected';

export type NotifType =
  | 'plan_posted' | 'new_joiner' | 'join_request' | 'joiner_left' | 'plan_full'
  | 'plan_starting_soon_host' | 'plan_started_host' | 'plan_ended_host'
  | 'endorse_reminder' | 'recap_reminder' | 'plan_cancelled_confirm'
  | 'host_marked_absent' | 'new_recap_on_your_plan'
  | 'request_approved' | 'request_declined' | 'plan_updated' | 'plan_cancelled'
  | 'plan_starting_soon_joiner' | 'plan_starting_15' | 'plan_ended_joiner' | 'marked_noshow'
  | 'mention'
  | 'endorsement_received' | 'attendance_score_improved' | 'attendance_score_dropped' | 'new_familiar_face'
  | 'recap_liked' | 'recap_commented' | 'recap_comment_replied' | 'new_recap_from_following' | 'story_expiring_soon'
  | 'new_follower' | 'follow_request' | 'follow_accepted' | 'following_posted_plan'
  | 'welcome' | 'profile_incomplete' | 'first_plan_nudge' | 'contact_joined'
  | 'plan_expired_host' | 'plan_expired_joiner';

// ── rows (snake_case = wire format from PostgREST) ──────────────────────
export interface UserPublic {           // users_public view — gender/dob never present
  id: string; name: string; handle: string;
  avatar_path: string | null; neighbourhood: string; bio: string | null;
  verification_level: VerificationLevel;
  profile_visibility: 'everyone' | 'followers' | 'nobody';
  plan_visibility: 'everyone' | 'followers';
  ig_handle: string | null; linkedin_handle: string | null; fb_handle: string | null;
  plans_hosted: number; plans_attended: number; people_met: number;
  attendance_score: number | null;     // null until 3 attendance events (D4)
  created_at: string;
}

export interface PlanRow {
  id: string; host_id: string; category_id: string;
  activity: string; description: string | null; rules: string | null;
  location_label: string; lat: number; lng: number;
  starts_at: string; capacity: number; spots_remaining: number;
  plan_type: PlanType; status: PlanStatus;
  cost: CostType; cost_note: string | null; gender_pref: GenderPref;
  created_at: string; updated_at: string;
  ended_at: string | null; cancelled_at: string | null;
}

export interface PlanMemberRow {
  id: string; plan_id: string; user_id: string;
  status: MemberStatus; is_host_row: boolean;
  joined_at: string; resolved_at: string | null;
}

export interface MessageRow {
  id: string; plan_id: string; author_id: string;
  body: string; is_deleted: boolean; created_at: string;
}

export interface RecapRow {
  id: string; plan_id: string; author_id: string;
  image_path: string; caption: string | null;
  like_count: number; comment_count: number;
  moderation: ModerationState; created_at: string;
}

export interface RecapCommentRow {
  id: string; recap_id: string; author_id: string;
  body: string; is_deleted: boolean; created_at: string;
}

export interface StoryRow {
  id: string; author_id: string; plan_id: string | null; plan_label: string | null;
  image_path: string; caption: string | null;
  moderation: ModerationState; expires_at: string; created_at: string;
}

export interface FollowRow {
  id: string; follower_id: string; following_id: string;
  status: FollowStatus; created_at: string;
}

export interface FamiliarFaceRow {
  user_a_id: string; user_b_id: string;
  plans_together: number; last_met_at: string;
}

export interface AttendanceMarkRow {
  id: string; plan_id: string; marked_by: string; subject_id: string;
  result: AttendanceResult; created_at: string;
}

export interface EndorsementRow {
  id: string; plan_id: string; giver_id: string; receiver_id: string;
  tag: string; created_at: string;
}
export interface EndorsementSummary { tag: string; count: number; }   // DB: top-5 RPC

export interface NotificationRow {
  id: string; user_id: string; type: NotifType; is_read: boolean;
  plan_id: string | null; actor_id: string | null; recap_id: string | null;
  body: string; created_at: string;
}

export interface HostNoshowVoteRow {
  id: string; plan_id: string; voter_id: string; created_at: string;
}

// ── RPC argument/response contracts ─────────────────────────────────────
export interface CompleteSignupArgs {
  p_name: string; p_handle: string; p_dob: string;       // dob sent once, never read back
  p_gender: 'man' | 'woman' | 'nonbinary' | 'prefer_not';
  p_neighbourhood: string;
}
export interface JoinPlanArgs { p_plan_id: string; p_idempotency_key: string; }
export interface SubmitEndorsementsArgs {
  p_plan_id: string;
  p_marks: { subject_id: string; result?: AttendanceResult; tag?: string }[]; // result host-only
}
export interface SubmitReportArgs {
  p_target_type: ReportTargetType; p_target_id: string;
  p_reason: ReportReason; p_notes?: string;
}

// typed RPC error codes raised by Postgres functions
export type ApiErrorCode =
  | 'gender_mismatch' | 'plan_full' | 'plan_closed' | 'chat_archived' | 'chat_closed'
  | 'endorsement_window_closed' | 'giver_not_present' | 'receiver_not_present'
  | 'host_cannot_join_own_plan' | 'rate_limited' | 'account_suspended'
  | 'handle_taken' | 'underage' | 'blocked';
```

**Frontend type migration note:** existing `src/types/*` (camelCase, with derived fields like `minutesUntilStart`, `joinerIds`, `isMine`) become *view models* mapped from the wire rows in a `src/api/mappers.ts` layer. Screens stay untouched, per the existing frontend architecture contract.

---

# Part 8 — External Services Configuration

| Service | Config item |
|---|---|
| Supabase | Pro plan, `ap-south-1`, PITR enabled before paid marketing |
| Twilio | Supabase Auth SMS provider; OTP rate limits: 5 sends/10min/phone, 3 attempts/OTP |
| Expo Push | `EXPO_ACCESS_TOKEN` in secrets; EAS Build + EAS Update already live |
| Google Vision | SafeSearch only; reject thresholds: adult ≥ LIKELY, violence ≥ VERY_LIKELY |
| Google Places | Autocomplete with 300ms debounce + session tokens |
| PostHog | RN SDK + Edge ingestion; event taxonomy per architecture doc Part 9 |
| Sentry | RN SDK, release tagging via EAS |
| Branch.io | Deferred deep links: `hopon://plan/{id}`, `hopon://profile/{id}`, `hopon://recap/{id}` + `https://hopon.app/...` OG fallback (minimal Next.js on Vercel) |
| Retool / Supabase Studio | Moderation queue over `reports` + `audit_logs` |
| GitHub Actions | `supabase db push` + `supabase functions deploy` on merge to `main` |

Rate limits enforced (RPC-level, `user_counters_daily`): 5 active plans, 20 joins/h, 50 follows/h, 30 msgs/min/plan, 10 reports/day, 3 recaps/plan, 3 cancels/24h ⇒ flag.

---

# Part 9 — Implementation Checklist

## Phase 0 — Project Setup (Day 1–2)
- [ ] Supabase project (Pro, ap-south-1); enable pg_cron, pg_net, pg_trgm, postgis
- [ ] `supabase init` in repo; CI: GitHub Actions deploy on main
- [ ] Local stack via Supabase CLI + Docker; port mock data → `supabase/seed.sql`
- [ ] Secrets: Twilio, Expo, Vision, founder alert phone
- [ ] Twilio configured as Auth SMS provider; OTP limits verified

## Phase 1 — Identity (Week 1)
- [ ] Migrations 0001–0004 applied
- [ ] `complete_signup`, `register_push_token`, `export_my_data`, `delete_account` RPCs
- [ ] users RLS + users_public view; verify gender/dob unreachable via PostgREST (test!)
- [ ] Client: wire SignupPhone/Otp → Supabase Auth; onboarding → complete_signup
- [ ] `contacts-match` Edge Function; client-side SHA-256 hashing before send
- [ ] ✅ Gate: new user can sign up, complete profile, appear in users_public without gender leakage

## Phase 2 — Core Plan Loop (Week 2)
- [ ] Migrations 0005–0006
- [ ] RPCs: `create_plan` (+14d check, ≤5 active, `plan_posted`, fanout invoke), `join_plan` (gender enforcement + idempotency + FOR UPDATE), `leave_plan`, `approve_request`, `decline_request`, `update_plan`, `cancel_plan`, `get_home_feed`, `search_plans`
- [ ] Concurrency test: 10 parallel joins on 1-spot plan ⇒ exactly 1 success
- [ ] Gender test matrix: woman→women ✓, man→women ✗, nonbinary→women ✗, all→everyone ✓
- [ ] Client: Home/Create/Plan/Requests screens off mocks onto live data (one screen at a time per review rule)
- [ ] ✅ Gate: full create→join→approve→leave loop on two physical devices

## Phase 3 — Realtime + Notifications (Week 3)
- [ ] Migrations 0007, 0011; chat-lock trigger; `notify()` helper
- [ ] Realtime channels: `plan:{id}:chat`, `plan:{id}:members`, `user:{id}:notifications`
- [ ] Edge: `push-sender`, `chat-push`; webhook on notifications + messages INSERT
- [ ] Cron: plan-starting-60/15, plan-started-5, plan-expiry, token-prune, job-retry (+ `pending_jobs`)
- [ ] Notification prefs screen wired to `notification_prefs` (full grouped taxonomy)
- [ ] ✅ Gate: message on device A appears <1s on device B; backgrounded device gets push; all 6 non-configurable types bypass prefs

## Phase 4 — Trust Layer (Week 4)
- [ ] Migration 0008; endorsement guard trigger
- [ ] RPCs: `end_plan` (S3 order), `submit_endorsements` (host + peer paths), `vote_host_noshow` (quorum), `compute_attendance_score` (D4), `rebuild_familiar_faces` (DA, host included), `get_endorsement_summary` (DB top-5)
- [ ] Score tests: 2 events ⇒ null; 3 ⇒ value; drop ⇒ `attendance_score_dropped` push
- [ ] Quorum tests: 2 present/2 votes ⇒ resolved (50%); 8 present/3 votes ⇒ resolved (3+); votes after 48h rejected
- [ ] Window tests: endorsement at 47h ✓, 49h ✗
- [ ] Client: EndorseScreen extended to all present attendees (host: attendance+tags; peers: tags only); FamiliarFaces live
- [ ] Frontend `MemberStatus` type += `'noshow'`
- [ ] ✅ Gate: end-to-end — plan ends, host marks, peers endorse, scores update, familiar faces appear, host-noshow quorum resolves

## Phase 5 — Social (Week 5)
- [ ] Migrations 0009, 0016 (buckets)
- [ ] Edge: `image-moderator` (Vision); rejection deletes object + row + audit log
- [ ] RPCs: `post_recap` (time-gate + 3/plan), `post_story` (24h), `follow_user`/`accept_follow`/`unfollow`, `record_story_view`, `search_users`
- [ ] Cron: story-expiring, story-cleanup, like-batch (+`recap_like_batches`)
- [ ] Edge: `fanout-followers` (`following_posted_plan`)
- [ ] Client: Recaps feed, RecapDetail (likes/comments live), Stories, Follow flows
- [ ] ✅ Gate: recap upload → moderation → followers notified; story dies at 24h; NSFW test image rejected

## Phase 6 — Safety & Moderation (Week 6)
- [ ] Migration 0010; escalation trigger; audit_logs (service-role only — verify zero client access)
- [ ] RPCs: `submit_report` (+auto-suspend & auto-hide thresholds), `block_user`/`unblock_user`
- [ ] Edge: `emergency-escalation` (founder SMS/email pager) — live-fire test
- [ ] Block-pair invisibility verified across: plans, recaps, stories, search, profiles, chat
- [ ] Retool/Studio moderation queue over reports + audit_logs
- [ ] Cron: account-hard-delete (F3 anonymisation), suspension-expiry — run against staged deleted account, verify endorsements survive anonymised, recaps gone
- [ ] ✅ Gate: emergency report pages founder <60s; suspended user blocked from all writes

## Phase 7 — Growth, Analytics, Launch Hardening (Week 7)
- [ ] Migration 0012 remainder: invites, feature_flags
- [ ] PostHog: full client event taxonomy + server events from Edge Functions
- [ ] Sentry wired with release tags
- [ ] Branch deep links + hopon.app OG fallback page
- [ ] Onboarding nudge crons (profile_incomplete, first_plan_nudge)
- [ ] Load test: 500 concurrent users browsing + 50 plan chats active
- [ ] Backup restore drill: restore yesterday's backup into a fresh project, verify
- [ ] Pen-check pass: anon key cannot read users base table, gender, reports, audit_logs, others' notifications; RLS on every table confirmed via `select * from pg_tables where rowsecurity = false`
- [ ] ✅ Gate: beta release candidate

---

# Part 10 — Blocking-Issue Protocol

The architecture is frozen. If implementation surfaces a genuine blocker (constraint contradiction, Supabase platform limitation, security hole), the protocol is:
1. Document the blocker against the relevant decision ID (D1–D13, S1–S3, F1–F5).
2. Propose the minimal delta — no scope expansion.
3. Founder sign-off before the delta lands; record it in this document's change log.

**Change log:** *(empty — v1.0 frozen)*
