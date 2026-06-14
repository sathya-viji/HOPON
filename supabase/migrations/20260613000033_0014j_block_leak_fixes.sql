-- ============================================================================
-- Migration 0014j — block-leak fix-forwards (Safety Interaction Matrix #2/#3/#5/#8)
-- Approved clean fixes. NOT touched here: #1 (per-content reporting), #4 (block +
-- shared chat), #6 (emergency-on-user), #7 (suspended content) — pending decision.
--
-- #2 a blocked user's comments/likes on a THIRD party's recap stayed visible.
--    Fixed at the RLS layer (direct/realtime reads) AND in get_recap_detail
--    (the definer read the client uses — RLS does not apply inside it).
-- #3 familiar_faces did not apply the block filter.
-- #5 match_contact_hashes (service role) ignored blocks.
-- #8 get_notifications surfaced rows whose actor is blocked.
-- ============================================================================

-- ── #2 comments/likes RLS: exclude block-paired authors ────────────────────
drop policy if exists recap_comments_select on recap_comments;
create policy recap_comments_select on recap_comments for select to authenticated
  using (
    exists (select 1 from recaps r where r.id = recap_id)
    and not is_blocked_pair(auth.uid(), author_id)
  );

drop policy if exists recap_likes_select on recap_likes;
create policy recap_likes_select on recap_likes for select to authenticated
  using (
    exists (select 1 from recaps r where r.id = recap_id)
    and not is_blocked_pair(auth.uid(), user_id)
  );

-- ── #2 (cont.) get_recap_detail: drop comments from block-paired authors ───
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
      from recap_comments c
      where c.recap_id=v_recap.id and not is_blocked_pair(v_uid, c.author_id))  -- #2
  );
end $$;

-- ── #3 familiar_faces RLS: exclude blocked counterpart ─────────────────────
drop policy if exists familiar_faces_select on familiar_faces;
create policy familiar_faces_select on familiar_faces for select to authenticated
  using (
    (user_a_id = auth.uid() and not is_blocked_pair(auth.uid(), user_b_id))
    or (user_b_id = auth.uid() and not is_blocked_pair(auth.uid(), user_a_id))
  );

-- ── #5 contact matching: exclude blocked pairs ─────────────────────────────
create or replace function match_contact_hashes(p_owner uuid, p_hashes text[])
returns setof users_public
language plpgsql security definer set search_path = public, extensions as $$
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
      and not is_blocked_pair(p_owner, up.id)        -- #5
      and au.phone is not null
      and encode(extensions.digest('+' || au.phone, 'sha256'), 'hex') = any (p_hashes);
end $$;
revoke execute on function match_contact_hashes from anon, authenticated, public;
grant execute on function match_contact_hashes to service_role;

-- ── #8 get_notifications: hide rows whose actor is now blocked ──────────────
create or replace function get_notifications(p_cursor integer default 0, p_limit integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
             'id', n.id, 'type', n.type, 'is_read', n.is_read, 'body', n.body,
             'plan_id', n.plan_id, 'recap_id', n.recap_id, 'created_at', n.created_at,
             'actor', (select to_jsonb(up) from users_public up where up.id = n.actor_id)
           ) as item, n.created_at
    from notifications n
    where n.user_id = v_uid
      and not is_blocked_pair(v_uid, n.actor_id)      -- #8 (null actor → false → kept)
    order by n.created_at desc
    offset greatest(p_cursor, 0) limit least(p_limit, 100)
  ) sub;
  return v_rows;
end $$;

-- preserve client grant on the replaced read RPCs
revoke execute on function get_recap_detail(uuid) from anon, public;
grant execute on function get_recap_detail(uuid) to authenticated, service_role;
revoke execute on function get_notifications(integer,integer) from anon, public;
grant execute on function get_notifications(integer,integer) to authenticated, service_role;
