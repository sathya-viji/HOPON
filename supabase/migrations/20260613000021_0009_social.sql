-- ============================================================================
-- Migration 0009 — social graph (recaps, likes, comments, stories, follows, feed)
-- Execution doc Part 1 Migration 0009 + Part 3 RLS + SOCIAL_GRAPH_MATRIX.md.
--
-- DEVIATION (approved): recaps carry 1–5 images via image_paths text[] (not the
-- frozen single image_path, not a recap_images table). See PHASE5_IMPACT.md.
--
-- Privacy: recaps are PUBLIC (D12) minus blocked pairs; stories follow the
-- author's profile_visibility. is_blocked_pair() is guarded on the Phase-6
-- blocks table so these policies need no reshape later. All mutations RPC-only.
-- ============================================================================

-- ─── block-pair helper (guarded on Phase-6 blocks table) ───────────────────
create or replace function is_blocked_pair(a uuid, b uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if a is null or b is null then return false; end if;
  if to_regclass('public.blocks') is null then return false; end if;   -- Phase 6
  return exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
end $$;
revoke execute on function is_blocked_pair(uuid, uuid) from anon, public;
grant execute on function is_blocked_pair(uuid, uuid) to authenticated, service_role;

-- ─── follows ────────────────────────────────────────────────────────────────
create table if not exists follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  status       follow_status_t not null default 'accepted',
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following on follows (following_id, status);
create index if not exists follows_follower  on follows (follower_id, status);

-- ─── recaps (1–5 images) ────────────────────────────────────────────────────
create table if not exists recaps (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id),
  author_id     uuid not null references users(id) on delete cascade,
  image_paths   text[] not null,
  caption       text check (char_length(caption) <= 280),
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  moderation    text not null default 'pending' check (moderation in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  -- coalesce: array_length of an empty array is NULL, which would pass a bare
  -- BETWEEN; force empty → 0 so 1..5 is genuinely enforced.
  constraint recaps_image_count check (coalesce(array_length(image_paths,1),0) between 1 and 5),
  constraint recaps_no_null_paths check (array_position(image_paths, null) is null)
);
create index if not exists recaps_plan   on recaps (plan_id, created_at desc);
create index if not exists recaps_author on recaps (author_id, created_at desc);

create table if not exists recap_likes (
  recap_id   uuid not null references recaps(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recap_id, user_id)
);

create table if not exists recap_comments (
  id         uuid primary key default gen_random_uuid(),
  recap_id   uuid not null references recaps(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists recap_comments_recap on recap_comments (recap_id, created_at);

-- counter triggers
create or replace function fn_recap_like_count() returns trigger
language plpgsql set search_path = public as $$
begin
  update recaps set like_count = like_count + (case when tg_op='INSERT' then 1 else -1 end)
  where id = coalesce(new.recap_id, old.recap_id);
  return coalesce(new, old);
end $$;
drop trigger if exists trg_recap_like_count on recap_likes;
create trigger trg_recap_like_count after insert or delete on recap_likes
  for each row execute function fn_recap_like_count();

create or replace function fn_recap_comment_count() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update recaps set comment_count = comment_count + 1 where id = new.recap_id;
  elsif tg_op = 'UPDATE' and new.is_deleted and not old.is_deleted then
    update recaps set comment_count = greatest(0, comment_count - 1) where id = new.recap_id;
  elsif tg_op = 'DELETE' then
    update recaps set comment_count = greatest(0, comment_count - 1) where id = old.recap_id;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_recap_comment_count on recap_comments;
create trigger trg_recap_comment_count after insert or update or delete on recap_comments
  for each row execute function fn_recap_comment_count();

-- ─── stories (24h, no active cap) ───────────────────────────────────────────
create table if not exists stories (
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
create index if not exists stories_author  on stories (author_id, expires_at desc);
create index if not exists stories_expires on stories (expires_at);

create table if not exists story_views (
  story_id  uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- ─── feed_events (D13 stub; write-only in Phase 5: recap_created/plan_created) ─
create table if not exists feed_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references users(id) on delete cascade,
  event_type text not null,
  object_id  uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists feed_events_actor on feed_events (actor_id, created_at desc);

-- ─── Privileges ─────────────────────────────────────────────────────────────
alter table follows        enable row level security;
alter table recaps         enable row level security;
alter table recap_likes    enable row level security;
alter table recap_comments enable row level security;
alter table stories        enable row level security;
alter table story_views    enable row level security;
alter table feed_events    enable row level security;

grant select on follows        to authenticated;
grant select on recaps         to authenticated;
grant select on recap_likes    to authenticated;
grant select on recap_comments to authenticated;
grant select on stories        to authenticated;
grant select on story_views    to authenticated;
-- feed_events: no client read in Phase 5 (write-only log)
grant select, insert, update, delete on follows        to service_role;
grant select, insert, update, delete on recaps         to service_role;
grant select, insert, update, delete on recap_likes    to service_role;
grant select, insert, update, delete on recap_comments to service_role;
grant select, insert, update, delete on stories        to service_role;
grant select, insert, update, delete on story_views    to service_role;
grant select, insert, update, delete on feed_events    to service_role;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- follows: see rows where you are either party
drop policy if exists follows_select on follows;
create policy follows_select on follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- recaps: PUBLIC (D12) when approved, minus blocked pairs; author sees own pending
drop policy if exists recaps_select on recaps;
create policy recaps_select on recaps for select to authenticated
  using (
    author_id = auth.uid()
    or (moderation = 'approved' and not is_blocked_pair(auth.uid(), author_id))
  );

-- likes/comments visible wherever the recap is visible
drop policy if exists recap_likes_select on recap_likes;
create policy recap_likes_select on recap_likes for select to authenticated
  using (exists (select 1 from recaps r where r.id = recap_id));

drop policy if exists recap_comments_select on recap_comments;
create policy recap_comments_select on recap_comments for select to authenticated
  using (exists (select 1 from recaps r where r.id = recap_id));

-- stories: follow author profile_visibility; approved + unexpired; minus blocks
drop policy if exists stories_select on stories;
create policy stories_select on stories for select to authenticated
  using (
    author_id = auth.uid()
    or (
      moderation = 'approved' and expires_at > now()
      and not is_blocked_pair(auth.uid(), author_id)
      and exists (
        select 1 from users u where u.id = author_id and u.deleted_at is null
        and u.account_status = 'active'
        and (
          u.profile_visibility = 'everyone'
          or (u.profile_visibility = 'followers'
              and exists (select 1 from follows f
                          where f.follower_id = auth.uid() and f.following_id = author_id
                          and f.status = 'accepted'))
        )
      )
    )
  );

-- story_views: author sees viewers of own story; viewer sees own row
drop policy if exists story_views_select on story_views;
create policy story_views_select on story_views for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );
