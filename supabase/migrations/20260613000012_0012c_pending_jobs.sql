-- ============================================================================
-- Migration 0012c — pending_jobs (partial early landing of doc migration 0012)
-- Sanctioned by the same "0012 remainder" wording as contact_hashes (0012a):
-- the Phase 3 job-retry cron + push-sender failure handling depend on it now.
-- Service-role only — written by Edge Functions and the retry cron.
-- ============================================================================
create table if not exists pending_jobs (
  id         uuid primary key default gen_random_uuid(),
  job_type   text not null,                 -- 'push-sender' | 'chat-push' | ...
  payload    jsonb not null,
  attempts   smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  next_retry timestamptz not null default now()
);
create index if not exists pending_jobs_retry on pending_jobs (next_retry) where attempts < 4;

alter table pending_jobs enable row level security;
revoke all on pending_jobs from anon, authenticated;
grant select, insert, update, delete on pending_jobs to service_role;
