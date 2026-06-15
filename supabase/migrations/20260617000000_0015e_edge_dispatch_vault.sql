-- ============================================================================
-- Migration 0015e — edge dispatch reads config from Vault (hosted Supabase).
--
-- 0015a wired fn_dispatch_edge to read edge_base_url / service_role_key from
-- GUCs set via `alter database postgres set app.settings.*`. That works locally
-- (superuser) but is REJECTED on hosted Supabase: the `postgres` role does not
-- own the `postgres` database, so `ALTER DATABASE ... SET` raises 42501. And
-- `ALTER ROLE ... SET` wouldn't reach the trigger-fired dispatches (push/chat/
-- moderation/emergency), since SECURITY DEFINER does not reload role-level GUCs.
--
-- Fix: read the two values from Supabase Vault when present, falling back to the
-- GUCs so local/CI behaviour (and the unconfigured no-op) is unchanged. All
-- dispatch call sites go through fn_dispatch_edge, so this single redefinition
-- covers push-sender, chat-push, image-moderator and emergency-escalation.
--
-- Provisioning (run OUT OF BAND so the key never enters git):
--   select vault.create_secret('https://<ref>.functions.supabase.co', 'edge_base_url');
--   select vault.create_secret('<service-role-key>',                   'edge_service_role_key');
-- ============================================================================
create or replace function fn_dispatch_edge(p_fn text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_base text; v_key text; v_req bigint;
begin
  -- Prefer Vault (hosted). Tolerate absence of the vault schema/view on plain
  -- Postgres so this stays a clean no-op on local/CI stacks.
  begin
    select decrypted_secret into v_base from vault.decrypted_secrets where name = 'edge_base_url';
    select decrypted_secret into v_key  from vault.decrypted_secrets where name = 'edge_service_role_key';
  exception when others then
    v_base := null; v_key := null;
  end;

  -- Fall back to GUCs (local dev sets these via `alter database ... set`).
  if v_base is null or v_base = '' then
    v_base := current_setting('app.settings.edge_base_url', true);
    v_key  := current_setting('app.settings.service_role_key', true);
  end if;

  if v_base is null or v_base = '' then
    return;   -- unconfigured (local/CI) — no-op
  end if;
  if to_regproc('net.http_post') is null then
    return;   -- pg_net absent
  end if;

  select net.http_post(
    url     := v_base || '/' || p_fn,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || coalesce(v_key,'')),
    body    := p_payload
  ) into v_req;
end $$;
revoke execute on function fn_dispatch_edge(text, jsonb) from anon, authenticated, public;
grant execute on function fn_dispatch_edge(text, jsonb) to service_role;
