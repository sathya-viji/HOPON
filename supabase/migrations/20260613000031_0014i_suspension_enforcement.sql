-- ============================================================================
-- Migration 0014i — suspension enforcement on content writes
-- create_plan / join_plan already gate on account_status='active'. This adds the
-- same gate to social/content inserts via one shared BEFORE INSERT trigger,
-- catching every write path (current and future) without re-pasting RPC bodies.
-- A suspended or soft-deleted actor cannot create recaps, comments, likes,
-- messages, follows, or stories.
-- ============================================================================
create or replace function fn_assert_actor_active() returns trigger
language plpgsql set search_path = public as $$
declare v_actor uuid;
begin
  execute format('select ($1).%I', tg_argv[0]) into v_actor using new;
  if not exists (select 1 from users
                 where id = v_actor and deleted_at is null and account_status = 'active') then
    raise exception 'account_suspended' using errcode='P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_active_recaps on recaps;
create trigger trg_active_recaps before insert on recaps
  for each row execute function fn_assert_actor_active('author_id');

drop trigger if exists trg_active_comments on recap_comments;
create trigger trg_active_comments before insert on recap_comments
  for each row execute function fn_assert_actor_active('author_id');

drop trigger if exists trg_active_likes on recap_likes;
create trigger trg_active_likes before insert on recap_likes
  for each row execute function fn_assert_actor_active('user_id');

drop trigger if exists trg_active_messages on messages;
create trigger trg_active_messages before insert on messages
  for each row execute function fn_assert_actor_active('author_id');

drop trigger if exists trg_active_follows on follows;
create trigger trg_active_follows before insert on follows
  for each row execute function fn_assert_actor_active('follower_id');

drop trigger if exists trg_active_stories on stories;
create trigger trg_active_stories before insert on stories
  for each row execute function fn_assert_actor_active('author_id');
