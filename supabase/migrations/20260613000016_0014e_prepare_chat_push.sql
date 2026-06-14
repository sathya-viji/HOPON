-- ============================================================================
-- Migration 0014e — prepare_chat_push (mention resolution moved into the DB)
--
-- chat-push runs as service_role, which intentionally has NO read grant on
-- `users` / `users_public` (Phase 1 privacy lockdown). Mention resolution and
-- recipient/author lookup therefore must happen in a security-definer function
-- that can read those tables, not in the Edge Function. This also keeps mention
-- matching correct for private-profile members of the plan (users_public would
-- hide them from the service role).
--
-- Supersedes the thin notify_mention() wrapper from 0014c (now unused).
-- ============================================================================
drop function if exists notify_mention(uuid, uuid, uuid, text);

create or replace function prepare_chat_push(p_message_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_msg        messages;
  v_plan       plans;
  v_author     text;
  v_recipients uuid[];
  r            record;
begin
  select * into v_msg from messages where id = p_message_id;
  if not found then return jsonb_build_object('found', false); end if;
  select * into v_plan from plans where id = v_msg.plan_id;
  select name into v_author from users where id = v_msg.author_id;

  -- @mentions → mention notifications (plan members only, excluding author)
  for r in
    select distinct u.id
    from regexp_matches(v_msg.body, '@([a-z0-9_.]{2,30})', 'g') as m(h)
    join users u on u.handle = '@' || lower((m.h)[1])
    where u.id <> v_msg.author_id
      and is_active_member(v_msg.plan_id, u.id)
  loop
    perform notify(r.id, 'mention',
      coalesce(v_author,'Someone') || ' mentioned you in ' || v_plan.activity,
      v_plan.id, v_msg.author_id);
  end loop;

  -- chat-push recipients = active members + host, minus the author
  select array_agg(distinct uid) into v_recipients
  from (
    select user_id as uid from plan_members
    where plan_id = v_msg.plan_id and status in ('joined','approved','attended') and not is_host_row
    union
    select v_plan.host_id
  ) s
  where uid <> v_msg.author_id;

  return jsonb_build_object(
    'found', true,
    'author_name', coalesce(v_author, 'Someone'),
    'activity', v_plan.activity,
    'preview', left(v_msg.body, 120),
    'recipient_ids', coalesce(to_jsonb(v_recipients), '[]'::jsonb)
  );
end $$;
revoke execute on function prepare_chat_push(uuid) from anon, authenticated, public;
grant execute on function prepare_chat_push(uuid) to service_role;
