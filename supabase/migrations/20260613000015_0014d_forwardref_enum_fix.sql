-- ============================================================================
-- Migration 0014d — fix-forward: enum casts in Phase 1 forward-ref inserts
--
-- Discovered when Phase 3 created the `notifications` table and activated the
-- previously-dormant guarded inserts in complete_signup / delete_account:
--   ERROR: column "type" is of type notif_type but expression is of type text
-- Text literals inside dynamic EXECUTE are NOT auto-cast to the enum (unlike
-- static SQL). Fix: add ::notif_type casts. Bodies are otherwise byte-identical
-- to migration 0014a. The Phase 1 migration file is left untouched (fix-forward
-- per the rollback strategy; "do not modify approved Phase 1 schema" honoured).
-- ============================================================================

create or replace function complete_signup(
  p_name          text,
  p_handle        text,
  p_dob           date,
  p_gender        gender_t,
  p_neighbourhood text
) returns users_public
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text := lower(trim(p_handle));
  v_phone  text;
  v_result users_public;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_result from users_public where id = v_uid;
  if found then
    return v_result;
  end if;

  if p_dob > current_date - interval '18 years' then
    raise exception 'underage' using errcode = 'P0001';
  end if;

  if v_handle !~ '^@[a-z0-9_.]{2,30}$' then
    raise exception 'invalid_handle' using errcode = 'P0001';
  end if;

  begin
    insert into users (id, name, handle, dob, gender, neighbourhood, verification_level)
    values (v_uid, trim(p_name), v_handle, p_dob, p_gender, trim(p_neighbourhood), 'phone');
  exception
    when unique_violation then
      raise exception 'handle_taken' using errcode = 'P0001';
    when check_violation then
      raise exception 'underage' using errcode = 'P0001';
  end;

  if to_regclass('public.notification_prefs') is not null then
    execute $g$
      insert into notification_prefs (user_id, event_type)
      select $1, t.t from unnest(enum_range(null::notif_type)) as t(t)
      on conflict do nothing
    $g$ using v_uid;
  end if;

  if to_regclass('public.notifications') is not null then
    execute $g$
      insert into notifications (user_id, type, body)
      values ($1, 'welcome'::notif_type, 'Your first plan is one tap away. What are you doing today?')
    $g$ using v_uid;
  end if;

  select phone into v_phone from auth.users where id = v_uid;
  if v_phone is not null
     and to_regclass('public.contact_hashes') is not null
     and to_regclass('public.notifications') is not null then
    execute $g$
      insert into notifications (user_id, type, actor_id, body)
      select distinct ch.owner_id, 'contact_joined'::notif_type, $1,
             (select name from users where id = $1) || ' from your contacts just joined. Follow them.'
      from contact_hashes ch
      where ch.phone_hash = encode(extensions.digest('+' || $2, 'sha256'), 'hex')
        and ch.owner_id <> $1
    $g$ using v_uid, v_phone;
  end if;

  if v_phone is not null and to_regclass('public.invites') is not null then
    execute $g$
      update invites
      set status = 'joined', converted_at = now()
      where phone_hash = encode(extensions.digest('+' || $1, 'sha256'), 'hex')
        and status = 'pending'
    $g$ using v_phone;
  end if;

  select * into v_result from users_public where id = v_uid;
  return v_result;
end $$;
revoke execute on function complete_signup from anon, public;
grant execute on function complete_signup to authenticated;

create or replace function delete_account() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update users
  set deleted_at = now(), account_status = 'suspended'
  where id = v_uid and deleted_at is null;

  if not found then
    return;
  end if;

  if to_regclass('public.plans') is not null then
    if to_regclass('public.notifications') is not null
       and to_regclass('public.plan_members') is not null then
      execute $g$
        insert into notifications (user_id, type, plan_id, body)
        select m.user_id, 'plan_cancelled'::notif_type, p.id,
               'The host cancelled ' || p.activity || '. Your spot has been released.'
        from plans p
        join plan_members m on m.plan_id = p.id
          and m.status in ('joined','approved','requested') and not m.is_host_row
        where p.host_id = $1 and p.status in ('active','full')
      $g$ using v_uid;
    end if;
    execute $g$
      update plans set status = 'cancelled', cancelled_at = now()
      where host_id = $1 and status in ('active','full')
    $g$ using v_uid;
  end if;

  delete from contact_hashes where owner_id = v_uid;

  if to_regclass('public.push_tokens') is not null then
    execute 'delete from push_tokens where user_id = $1' using v_uid;
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute $g$
      insert into audit_logs (actor_type, actor_id, action, target_type, target_id, detail)
      values ('user', $1, 'account_delete_requested', 'user', $1,
              jsonb_build_object('hard_delete_due', now() + interval '30 days'))
    $g$ using v_uid;
  end if;
end $$;
revoke execute on function delete_account from anon, public;
grant execute on function delete_account to authenticated;
