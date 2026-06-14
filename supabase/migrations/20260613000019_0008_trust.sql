-- ============================================================================
-- Migration 0008 — trust layer tables
-- Execution doc Part 1 Migration 0008 + Part 3 RLS + Part 6 (trust arch).
--   attendance_marks  — host (and quorum) assertions of present/no-show
--   endorsements      — peer endorsements (D6): 1 tag per giver→receiver per plan
--   host_noshow_votes — quorum votes (D7)
--   familiar_faces    — materialised co-attendance graph (DA), host included (D5)
-- All writes are RPC-only (submit_endorsements / vote_host_noshow / end_plan /
-- rebuild_familiar_faces). Clients read own-scoped rows via RLS.
-- ============================================================================

-- ─── attendance_marks ───────────────────────────────────────────────────────
create table if not exists attendance_marks (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id),
  marked_by  uuid not null references users(id),
  subject_id uuid not null references users(id),
  result     attendance_result not null,
  created_at timestamptz not null default now(),
  unique (plan_id, subject_id)
);
create index if not exists att_marks_plan    on attendance_marks (plan_id);
create index if not exists att_marks_subject on attendance_marks (subject_id);

-- ─── endorsements (D6 peer endorsements) ────────────────────────────────────
create table if not exists endorsements (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id),
  giver_id    uuid not null references users(id),
  receiver_id uuid not null references users(id),
  tag         text not null check (char_length(tag) between 1 and 50),
  created_at  timestamptz not null default now(),
  unique (plan_id, giver_id, receiver_id),
  check (giver_id <> receiver_id)
);
create index if not exists endorsements_recv on endorsements (receiver_id, tag);

-- both parties must be marked present; within 48h of ended_at (S2)
create or replace function fn_endorsement_guard() returns trigger
language plpgsql set search_path = public as $$
declare p plans;
begin
  select * into p from plans where id = new.plan_id;
  if p.ended_at is null or now() > p.ended_at + interval '48 hours' then
    raise exception 'endorsement_window_closed' using errcode='P0001';
  end if;
  if not exists (select 1 from attendance_marks
                 where plan_id=new.plan_id and subject_id=new.giver_id and result='present') then
    raise exception 'giver_not_present' using errcode='P0001';
  end if;
  if not exists (select 1 from attendance_marks
                 where plan_id=new.plan_id and subject_id=new.receiver_id and result='present') then
    raise exception 'receiver_not_present' using errcode='P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_endorsement_guard on endorsements;
create trigger trg_endorsement_guard before insert on endorsements
  for each row execute function fn_endorsement_guard();

-- ─── host_noshow_votes (D7 quorum) ──────────────────────────────────────────
create table if not exists host_noshow_votes (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id),
  voter_id   uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (plan_id, voter_id)
);

-- ─── familiar_faces (DA, canonical pair ordering) ───────────────────────────
create table if not exists familiar_faces (
  user_a_id      uuid not null references users(id) on delete cascade,
  user_b_id      uuid not null references users(id) on delete cascade,
  plans_together smallint not null default 1,
  last_met_at    timestamptz not null,
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);
create index if not exists ff_a on familiar_faces (user_a_id);
create index if not exists ff_b on familiar_faces (user_b_id);

-- ─── Privileges ─────────────────────────────────────────────────────────────
alter table attendance_marks  enable row level security;
alter table endorsements      enable row level security;
alter table host_noshow_votes enable row level security;
alter table familiar_faces    enable row level security;

grant select on attendance_marks  to authenticated;     -- RLS: giver/subject
grant select on endorsements      to authenticated;     -- RLS: giver/receiver
grant select on host_noshow_votes to authenticated;     -- RLS: own vote
grant select on familiar_faces    to authenticated;     -- RLS: rows containing self
grant select, insert, update, delete on attendance_marks  to service_role;
grant select, insert, update, delete on endorsements      to service_role;
grant select, insert, update, delete on host_noshow_votes to service_role;
grant select, insert, update, delete on familiar_faces    to service_role;

-- ─── RLS: own-scoped reads; writes are RPC-only ────────────────────────────
drop policy if exists attendance_marks_select on attendance_marks;
create policy attendance_marks_select on attendance_marks
  for select to authenticated using (marked_by = auth.uid() or subject_id = auth.uid());

drop policy if exists endorsements_select on endorsements;
create policy endorsements_select on endorsements
  for select to authenticated using (giver_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists host_noshow_votes_select on host_noshow_votes;
create policy host_noshow_votes_select on host_noshow_votes
  for select to authenticated using (voter_id = auth.uid());

drop policy if exists familiar_faces_select on familiar_faces;
create policy familiar_faces_select on familiar_faces
  for select to authenticated using (user_a_id = auth.uid() or user_b_id = auth.uid());
