-- ============================================================================
-- Migration 0014g — Phase 5 RPCs (Social: recaps, stories, follows, feed, cron)
-- Execution doc Part 4/5/6 + SOCIAL_GRAPH_MATRIX.md. RPC-only mutations;
-- security definer; explicit grants at the end. Notifications fire on
-- moderation APPROVAL (approve_recap/approve_story), not on raw create.
-- ============================================================================

-- ─────────────────────────── RECAPS: writes ────────────────────────────────
create or replace function post_recap(p_plan_id uuid, p_image_paths text[], p_caption text default null)
returns recaps
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan plans; v_recap recaps; v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if now() < v_plan.starts_at then raise exception 'plan_not_started' using errcode='P0001'; end if;
  if not is_active_member(p_plan_id, v_uid) then raise exception 'not_member' using errcode='P0001'; end if;
  if array_length(p_image_paths,1) is null or array_length(p_image_paths,1) < 1
     or array_length(p_image_paths,1) > 5 then
    raise exception 'invalid_image_count' using errcode='P0001';
  end if;
  select count(*) into v_count from recaps where plan_id=p_plan_id and author_id=v_uid;
  if v_count >= 3 then raise exception 'too_many_recaps' using errcode='P0001'; end if;

  insert into recaps (plan_id, author_id, image_paths, caption)
  values (p_plan_id, v_uid, p_image_paths, p_caption)
  returning * into v_recap;
  -- moderation 'pending'; image-moderator → approve_recap fires notifications
  return v_recap;
end $$;

-- approve_recap (service-role; called by image-moderator on pass) ────────────
create or replace function approve_recap(p_recap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_recap recaps; v_plan plans; v_name text; r record;
begin
  select * into v_recap from recaps where id = p_recap_id;
  if not found or v_recap.moderation = 'approved' then return; end if;
  update recaps set moderation='approved' where id = p_recap_id;
  select * into v_plan from plans where id = v_recap.plan_id;
  select name into v_name from users where id = v_recap.author_id;

  insert into feed_events (actor_id, event_type, object_id)
  values (v_recap.author_id, 'recap_created', v_recap.id);

  if v_plan.host_id <> v_recap.author_id then
    perform notify(v_plan.host_id, 'new_recap_on_your_plan',
      v_name || ' shared a moment from your ' || v_plan.activity || ' plan.',
      v_plan.id, v_recap.author_id, v_recap.id);
  end if;

  for r in select follower_id from follows
           where following_id = v_recap.author_id and status='accepted' loop
    perform notify(r.follower_id, 'new_recap_from_following',
      v_name || ' posted a recap.', v_plan.id, v_recap.author_id, v_recap.id);
  end loop;
end $$;

create or replace function reject_recap(p_recap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update recaps set moderation='rejected' where id = p_recap_id;
end $$;

create or replace function like_recap(p_recap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_author uuid; v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select author_id into v_author from recaps where id = p_recap_id and moderation='approved';
  if not found then raise exception 'recap_not_found' using errcode='P0001'; end if;

  insert into recap_likes (recap_id, user_id) values (p_recap_id, v_uid)
  on conflict do nothing;
  get diagnostics v_n = row_count;

  -- queue a batched recap_liked (never notify self-like)
  if v_n > 0 and v_author <> v_uid then
    insert into recap_like_batches (recap_id, unsent_count) values (p_recap_id, 1)
    on conflict (recap_id) do update set unsent_count = recap_like_batches.unsent_count + 1;
  end if;
end $$;

create or replace function unlike_recap(p_recap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  delete from recap_likes where recap_id = p_recap_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    update recap_like_batches set unsent_count = greatest(0, unsent_count - 1)
    where recap_id = p_recap_id;
  end if;
end $$;

create or replace function comment_recap(p_recap_id uuid, p_body text)
returns recap_comments
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_recap recaps; v_name text; v_comment recap_comments; r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if char_length(coalesce(trim(p_body),'')) = 0 then raise exception 'empty_comment' using errcode='P0001'; end if;
  select * into v_recap from recaps where id = p_recap_id and moderation='approved';
  if not found then raise exception 'recap_not_found' using errcode='P0001'; end if;

  insert into recap_comments (recap_id, author_id, body) values (p_recap_id, v_uid, trim(p_body))
  returning * into v_comment;
  select name into v_name from users where id = v_uid;

  -- notify recap author
  if v_recap.author_id <> v_uid then
    perform notify(v_recap.author_id, 'recap_commented',
      v_name || ': ' || left(trim(p_body),80), v_recap.plan_id, v_uid, p_recap_id);
  end if;
  -- notify distinct prior commenters (excl. recap author + this commenter)
  for r in
    select distinct author_id from recap_comments
    where recap_id = p_recap_id and author_id <> v_uid and author_id <> v_recap.author_id
      and not is_deleted and id <> v_comment.id
  loop
    perform notify(r.author_id, 'recap_comment_replied',
      v_name || ' also commented.', v_recap.plan_id, v_uid, p_recap_id);
  end loop;

  return v_comment;
end $$;

create or replace function delete_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  update recap_comments set is_deleted=true, body='[deleted]'
  where id = p_comment_id and author_id = v_uid and not is_deleted;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'comment_not_found' using errcode='P0001'; end if;
end $$;

create or replace function delete_recap(p_recap_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  delete from feed_events where event_type='recap_created' and object_id=p_recap_id;
  delete from recaps where id = p_recap_id and author_id = v_uid;  -- cascades likes/comments
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'recap_not_found' using errcode='P0001'; end if;
end $$;

-- ─────────────────────────── RECAPS: reads ─────────────────────────────────
create or replace function get_recaps_feed(p_cursor integer default 0, p_limit integer default 20)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'id', r.id, 'plan_id', r.plan_id, 'image_paths', r.image_paths, 'caption', r.caption,
      'like_count', r.like_count, 'comment_count', r.comment_count, 'created_at', r.created_at,
      'author', (select to_jsonb(up) from users_public up where up.id = r.author_id),
      'liked_by_me', exists (select 1 from recap_likes l where l.recap_id=r.id and l.user_id=v_uid)
    ) as item, r.created_at
    from recaps r
    where r.moderation='approved' and not is_blocked_pair(v_uid, r.author_id)
    order by r.created_at desc
    offset greatest(p_cursor,0) limit least(p_limit,100)
  ) s;
  return v_rows;
end $$;

create or replace function get_recap_detail(p_recap_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_recap recaps;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_recap from recaps where id = p_recap_id;
  if not found or (v_recap.moderation <> 'approved' and v_recap.author_id <> v_uid)
     or is_blocked_pair(v_uid, v_recap.author_id) then
    raise exception 'recap_not_found' using errcode='P0001';
  end if;
  return jsonb_build_object(
    'id', v_recap.id, 'plan_id', v_recap.plan_id, 'image_paths', v_recap.image_paths,
    'caption', v_recap.caption, 'like_count', v_recap.like_count, 'comment_count', v_recap.comment_count,
    'created_at', v_recap.created_at,
    'author', (select to_jsonb(up) from users_public up where up.id = v_recap.author_id),
    'liked_by_me', exists (select 1 from recap_likes l where l.recap_id=v_recap.id and l.user_id=v_uid),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body, 'created_at', c.created_at, 'is_deleted', c.is_deleted,
        'author', (select to_jsonb(up) from users_public up where up.id=c.author_id)
      ) order by c.created_at), '[]'::jsonb)
      from recap_comments c where c.recap_id=v_recap.id)
  );
end $$;

-- ─────────────────────────── STORIES ───────────────────────────────────────
create or replace function post_story(p_image_path text, p_caption text default null,
  p_plan_id uuid default null, p_plan_label text default null)
returns stories
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_story stories;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  -- no active-story cap (per decision)
  insert into stories (author_id, image_path, caption, plan_id, plan_label)
  values (v_uid, p_image_path, p_caption, p_plan_id, p_plan_label)
  returning * into v_story;
  return v_story;  -- moderation pending; approve_story flips it
end $$;

create or replace function approve_story(p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update stories set moderation='approved' where id = p_story_id and moderation <> 'approved';
end $$;

create or replace function reject_story(p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update stories set moderation='rejected' where id = p_story_id;
end $$;

create or replace function record_story_view(p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if not exists (select 1 from stories where id=p_story_id) then
    raise exception 'story_not_found' using errcode='P0001';
  end if;
  insert into story_views (story_id, viewer_id) values (p_story_id, v_uid)
  on conflict do nothing;
end $$;

create or replace function delete_story(p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  delete from stories where id = p_story_id and author_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'story_not_found' using errcode='P0001'; end if;
end $$;

-- ─────────────────────────── FOLLOWS (S1) ──────────────────────────────────
create or replace function follow_user(p_user_id uuid)
returns follows
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_vis profile_vis; v_status follow_status_t; v_follow follows; v_name text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_user_id = v_uid then raise exception 'cannot_follow_self' using errcode='P0001'; end if;
  if is_blocked_pair(v_uid, p_user_id) then raise exception 'blocked' using errcode='P0001'; end if;
  select profile_visibility into v_vis from users
    where id=p_user_id and deleted_at is null and account_status='active';
  if not found then raise exception 'user_not_found' using errcode='P0001'; end if;
  if v_vis = 'nobody' then raise exception 'cannot_follow' using errcode='P0001'; end if;

  v_status := case when v_vis='everyone' then 'accepted' else 'pending' end;
  insert into follows (follower_id, following_id, status) values (v_uid, p_user_id, v_status)
  on conflict (follower_id, following_id) do update set status = follows.status
  returning * into v_follow;

  select name into v_name from users where id=v_uid;
  if v_status='accepted' then
    perform notify(p_user_id, 'new_follower', v_name || ' is now following you.', null, v_uid);
  else
    perform notify(p_user_id, 'follow_request', v_name || ' wants to follow you.', null, v_uid);
  end if;
  return v_follow;
end $$;

create or replace function accept_follow(p_follower_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer; v_name text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  update follows set status='accepted'
  where follower_id=p_follower_id and following_id=v_uid and status='pending';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'request_not_found' using errcode='P0001'; end if;
  select name into v_name from users where id=v_uid;
  perform notify(p_follower_id, 'follow_accepted',
    'You can now see ' || v_name || '''s plans and recaps.', null, v_uid);
end $$;

create or replace function decline_follow(p_follower_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  -- silent decline (no notification, S1)
  delete from follows where follower_id=p_follower_id and following_id=v_uid and status='pending';
end $$;

create or replace function unfollow(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  delete from follows where follower_id=v_uid and following_id=p_user_id;
end $$;

-- ─────────────────────── following_posted_plan fan-out ──────────────────────
-- Called inline by create_plan (Phase 2 hook via to_regprocedure). Off the
-- user's critical path only modestly; flags a scaling concern past 1000.
create or replace function fanout_following_posted_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan plans; v_name text; v_followers integer; r record;
begin
  select * into v_plan from plans where id = p_plan_id;
  if not found then return; end if;
  select name into v_name from users where id = v_plan.host_id;

  insert into feed_events (actor_id, event_type, object_id)
  values (v_plan.host_id, 'plan_created', v_plan.id);

  select count(*) into v_followers from follows
    where following_id=v_plan.host_id and status='accepted';
  if v_followers > 1000 and to_regclass('public.audit_logs') is not null then
    insert into audit_logs (actor_type, action, target_type, target_id, detail)
    values ('system','fanout_scale_flag','plan',p_plan_id, jsonb_build_object('followers',v_followers));
  end if;

  for r in select follower_id from follows
           where following_id=v_plan.host_id and status='accepted' loop
    perform notify(r.follower_id, 'following_posted_plan',
      v_name || ' is doing ' || v_plan.activity || ' at ' || v_plan.location_label || '.', v_plan.id, v_plan.host_id);
  end loop;
end $$;

-- ─────────────────────────── CRON logic ────────────────────────────────────
-- like-batch flush: emit one recap_liked per recap with enough pending likes
create or replace function fn_flush_like_batches(p_threshold integer default 10)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; b record; v_author uuid;
begin
  for b in select recap_id, unsent_count from recap_like_batches where unsent_count >= p_threshold loop
    select author_id into v_author from recaps where id = b.recap_id;
    if v_author is not null then
      perform notify(v_author, 'recap_liked',
        'Your recap has ' || b.unsent_count || ' new likes.', null, null, b.recap_id);
      n := n + 1;
    end if;
    update recap_like_batches set unsent_count=0, last_sent_at=now() where recap_id=b.recap_id;
  end loop;
  return n;
end $$;

-- story expiring soon: 90–150 min before expiry
create or replace function fn_notify_story_expiring()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; s record;
begin
  for s in select * from stories
           where moderation='approved'
             and expires_at between now() + interval '90 minutes' and now() + interval '150 minutes' loop
    if not exists (select 1 from notifications
                   where user_id=s.author_id and recap_id is null and type='story_expiring_soon'
                     and created_at > now() - interval '6 hours') then
      perform notify(s.author_id, 'story_expiring_soon', 'Your story expires soon — share it before it disappears.');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- story cleanup: delete expired rows (storage object cleanup is the Edge cron)
create or replace function fn_cleanup_stories()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from stories where expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- recap reminder: plans ended 180–195 min ago → host + present members who
-- have not posted a recap
create or replace function fn_notify_recap_reminder()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record; u record;
begin
  for p in select * from plans
           where status='ended' and ended_at between now() - interval '195 minutes' and now() - interval '180 minutes' loop
    for u in
      select distinct am.subject_id as uid from attendance_marks am
      where am.plan_id=p.id and am.result='present'
    loop
      if not exists (select 1 from recaps where plan_id=p.id and author_id=u.uid)
         and not exists (select 1 from notifications where user_id=u.uid and plan_id=p.id and type='recap_reminder') then
        perform notify(u.uid, 'recap_reminder', 'How was ' || p.activity || '? Post a recap before the memory fades.', p.id);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- ─────────────────────────── STORIES feed read ─────────────────────────────
create or replace function get_stories_feed()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  -- active, visible stories grouped by author (RLS policy already filters)
  select coalesce(jsonb_agg(item order by latest desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'author', (select to_jsonb(up) from users_public up where up.id = s.author_id),
      'stories', jsonb_agg(jsonb_build_object('id', s.id, 'image_path', s.image_path,
        'caption', s.caption, 'plan_label', s.plan_label, 'expires_at', s.expires_at,
        'seen', exists (select 1 from story_views v where v.story_id=s.id and v.viewer_id=v_uid))
        order by s.created_at)
    ) as item, max(s.created_at) as latest
    from stories s
    where s.moderation='approved' and s.expires_at > now()
    group by s.author_id
  ) g;
  return v_rows;
end $$;

-- ─────────────────────────── Grants ────────────────────────────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'post_recap(uuid,text[],text)','like_recap(uuid)','unlike_recap(uuid)',
    'comment_recap(uuid,text)','delete_comment(uuid)','delete_recap(uuid)',
    'get_recaps_feed(integer,integer)','get_recap_detail(uuid)',
    'post_story(text,text,uuid,text)','record_story_view(uuid)','delete_story(uuid)',
    'get_stories_feed()',
    'follow_user(uuid)','accept_follow(uuid)','decline_follow(uuid)','unfollow(uuid)'
  ] loop
    execute format('revoke execute on function %s from anon, public', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;

  foreach fn in array array[
    'approve_recap(uuid)','reject_recap(uuid)','approve_story(uuid)','reject_story(uuid)',
    'fanout_following_posted_plan(uuid)',
    'fn_flush_like_batches(integer)','fn_notify_story_expiring()','fn_cleanup_stories()','fn_notify_recap_reminder()'
  ] loop
    execute format('revoke execute on function %s from anon, authenticated, public', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
