-- ============================================================================
-- Migration 0014a — Phase 1 RPC functions (doc Part 4: 4.1, 4.17, 4.18 + contacts helper)
-- All functions: security definer, pinned search_path, typed error codes
-- (ApiErrorCode contract in Part 7 of the execution doc).
--
-- Forward-phase references (notifications, plans, push_tokens, audit_logs,
-- invites) are guarded with to_regclass() + dynamic SQL so these functions are
-- correct TODAY and automatically gain behaviour as later phases land —
-- without ever being rewritten. This is the doc's own seeding pattern.
-- ============================================================================

-- ─── 4.1 complete_signup ────────────────────────────────────────────────────
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

  -- Idempotent: a retried signup returns the existing profile.
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

  -- ── Guarded forward-phase behaviour ──────────────────────────────────────
  -- Seed notification_prefs defaults (Phase 3 table).
  if to_regclass('public.notification_prefs') is not null then
    execute $g$
      insert into notification_prefs (user_id, event_type)
      select $1, t.t from unnest(enum_range(null::notif_type)) as t(t)
      on conflict do nothing
    $g$ using v_uid;
  end if;

  -- Welcome notification (Phase 3 table).
  if to_regclass('public.notifications') is not null then
    execute $g$
      insert into notifications (user_id, type, body)
      values ($1, 'welcome', 'Your first plan is one tap away. What are you doing today?')
    $g$ using v_uid;
  end if;

  -- contact_joined: notify existing users who hold this phone in their
  -- synced contacts (inverse match on the new user's phone hash).
  select phone into v_phone from auth.users where id = v_uid;
  if v_phone is not null
     and to_regclass('public.contact_hashes') is not null
     and to_regclass('public.notifications') is not null then
    execute $g$
      insert into notifications (user_id, type, actor_id, body)
      select distinct ch.owner_id, 'contact_joined', $1,
             (select name from users where id = $1) || ' from your contacts just joined. Follow them.'
      from contact_hashes ch
      where ch.phone_hash = encode(extensions.digest('+' || $2, 'sha256'), 'hex')
        and ch.owner_id <> $1
    $g$ using v_uid, v_phone;
  end if;

  -- Invite conversion (Phase 7 table).
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

-- ─── 4.18 export_my_data — PDPB data export ─────────────────────────────────
create or replace function export_my_data() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_export jsonb;
  v_part   jsonb;
  v_table  record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Profile: full row INCLUDING private fields — it is the user's own data.
  select to_jsonb(u) - 'suspension_reason' into v_export
  from users u where u.id = v_uid;

  if v_export is null then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;

  v_export := jsonb_build_object('profile', v_export, 'exported_at', now());

  -- User-owned rows across all phases, each guarded. (table, owner column)
  for v_table in
    select * from (values
      ('plans',            'host_id'),
      ('plan_members',     'user_id'),
      ('messages',         'author_id'),
      ('recaps',           'author_id'),
      ('recap_likes',      'user_id'),
      ('recap_comments',   'author_id'),
      ('stories',          'author_id'),
      ('follows',          'follower_id'),
      ('blocks',           'blocker_id'),
      ('reports',          'reporter_id'),
      ('attendance_marks', 'subject_id'),
      ('endorsements',     'giver_id'),
      ('notifications',    'user_id'),
      ('notification_prefs','user_id'),
      ('contact_hashes',   'owner_id'),
      ('invites',          'inviter_id')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || v_table.tbl) is not null then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x where x.%I = $1',
        v_table.tbl, v_table.col
      ) into v_part using v_uid;
      v_export := v_export || jsonb_build_object(v_table.tbl, v_part);
    end if;
  end loop;

  return v_export;
end $$;

revoke execute on function export_my_data from anon, public;
grant execute on function export_my_data to authenticated;

-- ─── 4.17 delete_account — F3 hybrid model, step 1 (soft delete) ────────────
-- Hard delete + anonymisation at +30 days is the account-hard-delete cron
-- (Phase 6/7). This function performs the immediate actions only.
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
    return;  -- idempotent: already deleted or no profile
  end if;

  -- Cancel hosted active plans, notifying members (Phase 2/3 tables, guarded).
  if to_regclass('public.plans') is not null then
    if to_regclass('public.notifications') is not null
       and to_regclass('public.plan_members') is not null then
      execute $g$
        insert into notifications (user_id, type, plan_id, body)
        select m.user_id, 'plan_cancelled', p.id,
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

  -- Immediate deletions (frozen F3 list).
  delete from contact_hashes where owner_id = v_uid;

  if to_regclass('public.push_tokens') is not null then
    execute 'delete from push_tokens where user_id = $1' using v_uid;
  end if;

  -- Audit trail (Phase 6 table, guarded).
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

-- ─── contacts-match helper: match_contact_hashes ────────────────────────────
-- Called by the contacts-match Edge Function with the SERVICE ROLE only.
-- Hash convention (D10, frozen): SHA-256 of E.164 WITH leading '+', lowercase
-- hex. auth.users.phone is stored without '+', hence the '+' || prefix here.
-- Returns only publicly visible, active users — same surface as users_public.
create or replace function match_contact_hashes(p_owner uuid, p_hashes text[])
returns setof users_public
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if array_length(p_hashes, 1) is null or array_length(p_hashes, 1) > 5000 then
    raise exception 'invalid_hash_batch' using errcode = 'P0001';
  end if;

  return query
    select up.*
    from users_public up
    join auth.users au on au.id = up.id
    where up.id <> p_owner
      and up.profile_visibility = 'everyone'
      and au.phone is not null
      and encode(extensions.digest('+' || au.phone, 'sha256'), 'hex') = any (p_hashes);
end $$;

-- Service-role only. NOT callable by clients; called by the contacts-match
-- Edge Function via the service client. EXECUTE must be granted explicitly —
-- revoking from public removes the default grant for service_role too.
revoke execute on function match_contact_hashes from anon, authenticated, public;
grant execute on function match_contact_hashes to service_role;
