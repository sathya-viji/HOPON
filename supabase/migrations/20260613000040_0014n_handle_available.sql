-- ============================================================================
-- Migration 0014n — handle_available (live username check on the name screen)
-- Checks the BASE users table (not users_public) so a handle owned by a private
-- or blocked user still counts as taken. Takes the bare handle (no '@'); the
-- stored value is '@' + lowercased handle, matching complete_signup. The final
-- insert still enforces uniqueness, so this is a UX pre-check, not the guard.
-- ============================================================================
create or replace function handle_available(p_handle text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from users where handle = '@' || lower(trim(p_handle))
  );
$$;
revoke execute on function handle_available(text) from public;
grant execute on function handle_available(text) to anon, authenticated;
