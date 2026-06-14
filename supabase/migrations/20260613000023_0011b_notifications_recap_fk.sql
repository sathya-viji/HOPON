-- ============================================================================
-- Migration 0011b — add notifications.recap_id FK (deferred from Phase 3)
-- recaps now exists (0009); wire the FK that Phase 3 left as a plain column.
-- Idempotent: only adds the constraint if absent.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_recap_id_fkey'
  ) then
    alter table notifications
      add constraint notifications_recap_id_fkey
      foreign key (recap_id) references recaps(id) on delete set null;
  end if;
end $$;
