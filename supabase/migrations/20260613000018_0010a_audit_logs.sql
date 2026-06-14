-- ============================================================================
-- Migration 0010a — audit_logs (partial early landing of doc migration 0010)
-- Same "remainder" precedent as contact_hashes (0012a) / pending_jobs (0012c):
-- Phase 4 trust actions (host_noshow_resolved, score_recomputed) need an audit
-- trail now. The full safety.sql (reports, blocks, escalation trigger) lands in
-- Phase 6 and re-declares this table idempotently (create table if not exists).
-- Service-role only — never client-readable (F5).
-- ============================================================================
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_type  text not null check (actor_type in ('admin','system','user')),
  actor_id    uuid,                         -- null for system
  action      text not null,
  target_type text not null,
  target_id   uuid,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_target on audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_action on audit_logs (action, created_at desc);

alter table audit_logs enable row level security;
revoke all on audit_logs from anon, authenticated;
grant select, insert, update, delete on audit_logs to service_role;
