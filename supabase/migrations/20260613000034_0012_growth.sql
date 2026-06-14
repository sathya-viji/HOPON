-- ============================================================================
-- Migration 0012 — growth (invites, feature_flags) — remainder of doc 0012
-- (contact_hashes/pending_jobs/audit_logs/recap_like_batches already early-landed
-- in their phases; this completes the table with invites + feature_flags.)
-- complete_signup already converts invites (guarded since Phase 1) — activates now.
-- ============================================================================

-- ── invites (growth loop; D10 hashed phones only) ──────────────────────────
create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid not null references users(id) on delete cascade,
  phone_hash   text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  status       text not null default 'pending' check (status in ('pending','joined')),
  created_at   timestamptz not null default now(),
  converted_at timestamptz
);
create index if not exists invites_hash on invites (phone_hash) where status = 'pending';
create index if not exists invites_inviter on invites (inviter_id);

alter table invites enable row level security;
grant select on invites to authenticated;                       -- RLS: own (inviter)
grant select, insert, update, delete on invites to service_role;

drop policy if exists invites_select_own on invites;
create policy invites_select_own on invites for select to authenticated
  using (inviter_id = auth.uid());

-- ── feature_flags (read-by-all; managed by admin/service) ──────────────────
create table if not exists feature_flags (
  flag_name   text primary key,
  enabled     boolean not null default false,
  rollout_pct smallint not null default 100 check (rollout_pct between 0 and 100),
  description text
);

alter table feature_flags enable row level security;
grant select on feature_flags to authenticated, anon;
grant select, insert, update, delete on feature_flags to service_role;

drop policy if exists feature_flags_read on feature_flags;
create policy feature_flags_read on feature_flags for select to authenticated, anon using (true);

-- ── create_invites RPC (store hashed phones of contacts not yet on hopon) ──
create or replace function create_invites(p_phone_hashes text[])
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if array_length(p_phone_hashes,1) is null or array_length(p_phone_hashes,1) > 5000 then
    raise exception 'invalid_hash_batch' using errcode='P0001';
  end if;
  -- only store hashes that match no existing user (true "not yet on hopon")
  insert into invites (inviter_id, phone_hash)
  select v_uid, h from unnest(p_phone_hashes) h
  where h ~ '^[0-9a-f]{64}$'
    and not exists (
      select 1 from auth.users au
      where au.phone is not null
        and encode(extensions.digest('+' || au.phone, 'sha256'), 'hex') = h)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function create_invites(text[]) from anon, public;
grant execute on function create_invites(text[]) to authenticated, service_role;

-- ── is_feature_enabled (deterministic % rollout by user id) ─────────────────
create or replace function is_feature_enabled(p_flag text)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare f feature_flags; v_uid uuid := auth.uid(); v_bucket int;
begin
  select * into f from feature_flags where flag_name = p_flag;
  if not found or not f.enabled then return false; end if;
  if f.rollout_pct >= 100 then return true; end if;
  if f.rollout_pct <= 0 then return false; end if;
  -- stable per-user bucket 0..99 from a hash of flag+uid
  v_bucket := ('x' || substr(encode(extensions.digest(p_flag || coalesce(v_uid::text,''), 'sha256'),'hex'),1,8))::bit(32)::bigint % 100;
  return v_bucket < f.rollout_pct;
end $$;
revoke execute on function is_feature_enabled(text) from anon, public;
grant execute on function is_feature_enabled(text) to authenticated, service_role;
