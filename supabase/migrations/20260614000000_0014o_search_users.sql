-- ============================================================================
-- Migration 0014o — search_users (people search for the Search screen)
--
-- Additive read RPC (post-Phase-7). Queries the users_public VIEW, so every
-- privacy rule already lives there: deleted/banned excluded, block-pairs
-- excluded (is_blocked_pair), and profile_visibility enforced (everyone /
-- followers / self). Nothing re-implemented here — we only rank + paginate.
--
-- Matching: the query is trimmed + lowercased; a leading '@' is stripped. Min
-- 2 chars (else '[]'). Handle is stored as '@'+lower(handle) (see complete_signup
-- 0014a, regex ^@[a-z0-9_.]{2,30}$), so we prefix-match the stored form with
-- LIKE to hit users_handle_pat (text_pattern_ops); name uses ILIKE '%q%' to hit
-- users_name_trgm (gin_trgm_ops). Self is excluded. Returns a jsonb array of
-- users_public rows — same row shape get_plan_detail.host uses, so the client's
-- mapPublicUser consumes it directly.
--
-- SECURITY DEFINER + pinned search_path, mirroring search_plans (0014b). auth.uid()
-- inside a definer fn still resolves to the CALLER (it reads the request JWT), so
-- the view's per-viewer visibility holds.
-- ============================================================================
create or replace function search_users(
  p_query  text,
  p_cursor integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    uuid    := auth.uid();
  v_q      text    := ltrim(lower(trim(coalesce(p_query, ''))), '@');
  v_handle text;
  v_limit  integer := 30;
  v_rows   jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if length(v_q) < 2 then return '[]'::jsonb; end if;

  v_handle := '@' || v_q;

  select coalesce(jsonb_agg(obj order by rank, att desc nulls last, nm), '[]'::jsonb) into v_rows
  from (
    select
      to_jsonb(up)        as obj,
      up.name             as nm,
      up.attendance_score as att,
      case
        when up.handle = v_handle              then 0   -- exact @handle
        when up.handle like v_handle || '%'    then 1   -- handle prefix
        when lower(up.name) like v_q || '%'    then 2   -- name prefix
        else 3                                          -- name contains
      end as rank
    from users_public up
    where up.id <> v_uid
      and (
        up.handle like v_handle || '%'
        or up.name ilike '%' || v_q || '%'
      )
    order by rank, att desc nulls last, nm
    offset greatest(p_cursor, 0)
    limit v_limit
  ) sub;

  return v_rows;
end $$;

revoke execute on function search_users(text, integer) from anon, public;
grant  execute on function search_users(text, integer) to authenticated, service_role;
