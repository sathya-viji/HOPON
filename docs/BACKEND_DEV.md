# HopOn — Backend Development Guide (Phase 0)

Source of truth: `../hopon-backend-execution.md` v1.0 (frozen). This guide covers
the day-to-day workflow only; it does not restate architecture.

---

## Repository structure (backend additions)

```
hopon/
├── supabase/
│   ├── config.toml              # local stack config (auth, buckets, OTP test numbers)
│   ├── seed.sql                 # dev seed, guarded per-phase with to_regclass()
│   ├── migrations/              # NNNN-ordered SQL, one file per execution-doc step
│   ├── functions/
│   │   └── _shared/             # env.ts, client.ts — shared by all Edge Functions
│   └── tests/                   # pgTAP / SQL assertion tests (added per phase)
├── scripts/
│   ├── db-reset.sh              # local reset: migrations + seed
│   └── new-migration.sh         # enforces NNNN_snake_case naming
├── .github/workflows/
│   └── supabase-deploy.yml      # PR validation + main deploy
├── .env.example                 # template — copy to .env.local
└── src/                         # existing Expo app (untouched in Phase 0)
```

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | latest | https://docker.com (required by Supabase local stack) |
| Supabase CLI | ≥ 1.200 | `brew install supabase/tap/supabase` |
| Deno | ≥ 1.40 | `brew install deno` (Edge Function dev/typecheck) |
| Node | per package.json | already in use for Expo |

Docker resource minimums for the local stack: 4 GB RAM, 2 CPUs.

## One-time setup

```bash
# 1. Local env
cp .env.example .env.local            # fill values after `supabase start`

# 2. Start the local stack (Postgres, Auth, Storage, Realtime, Studio, Edge runtime)
supabase start                        # prints anon key + service key → .env.local

# 3. Production project (founder runs once)
supabase login
supabase projects create hopon --region ap-south-1 --org-id <org>
supabase link --project-ref <ref>

# 4. Production dashboard (manual, once):
#    - Plan: Pro
#    - Auth → Phone → Twilio credentials
#    - Auth → Rate limits: 5 OTP sends / 10 min
#    - Database → Extensions: enable pg_cron, pg_net (pg_trgm/postgis via migration)
#    - Point-in-time recovery: enable before any paid marketing

# 5. Edge Function secrets (production)
supabase secrets set \
  GOOGLE_VISION_KEY=... EXPO_ACCESS_TOKEN=... \
  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=... \
  FOUNDER_ALERT_PHONE=... EDGE_BASE_URL=https://<ref>.supabase.co/functions/v1
```

## Daily workflow

```bash
supabase start                  # bring up local stack
./scripts/db-reset.sh           # clean DB: all migrations + seed
npx expo start                  # app against local Supabase (.env.local URLs)
supabase functions serve        # hot-reload Edge Functions locally
supabase stop                   # end of day (keeps data; --no-backup to wipe)
```

Local test logins: `+919999999991/2/3` with OTPs `123451/2/3` (see config.toml).

## Migration process (frozen)

1. `./scripts/new-migration.sh 0001_extensions` — NNNN order from the execution doc.
2. Write **idempotent** SQL: `create table if not exists`, `create or replace function`,
   `drop trigger if exists` before `create trigger`, `on conflict do nothing` for
   reference inserts. Enum creation wrapped in `do $$ begin ... exception when duplicate_object then null; end $$;`.
3. `./scripts/db-reset.sh` — must apply cleanly from zero.
4. PR → CI validates: clean apply, `db lint`, drift check.
5. Merge to `main` → CI runs `supabase db push` against production, then deploys functions.

Never edit a migration that has reached `main`. Fixes are new migrations.

## Branching strategy

```
main                  ← production. Protected. Deploys on merge.
└── phase-N/<topic>   ← one branch per execution-doc phase deliverable
    e.g. phase-1/identity-migrations, phase-1/complete-signup-rpc
```

- PRs target `main`; require CI green + one review.
- Phase gates (execution doc Part 9) are verified on the phase's final PR.
- No long-lived develop branch — phases are small enough to ship serially.

## Rollback strategy

| Failure point | Action |
|---|---|
| Migration fails in CI (PR) | Fix in branch — production untouched. |
| Migration fails during `db push` to prod | Postgres runs each migration in a transaction: the failed file is fully rolled back. Fix forward with a corrected migration; never edit the failed file if it partially shipped in an earlier deploy. |
| Bad-but-applied migration in prod | Write an explicit **down migration** as a new NNNN file (drop/alter back). Pure-DDL reverts only; data-destructive reverts require founder sign-off. |
| Bad Edge Function deploy | `supabase functions deploy <name>` from the previous git tag — functions are stateless, redeploy is the rollback. |
| Data corruption | Supabase daily backup restore (Pro: 7-day retention; PITR after upgrade). Restore drill is a Phase 7 checklist item. |

Every production deploy is a git commit on `main`; tag releases `backend-vX.Y` so
function rollback targets are unambiguous.

## Secrets management (frozen)

| Secret class | Lives in | Never in |
|---|---|---|
| Anon key, public API URLs | `.env.local`, EAS build env (`EXPO_PUBLIC_*`) | — (public by design) |
| Service role key | Supabase secrets store (auto-injected to Edge Functions) | client bundle, git, CI logs |
| Twilio / Vision / Expo push / founder phone | `supabase secrets set` | any .env file |
| CLI access token + DB password | GitHub Actions secrets, local keychain | git |

`supabase/.gitignore` blocks all `.env*` files inside the supabase dir; the repo
root `.gitignore` must contain `.env.local` (verify — Phase 0 checklist).

## Service-role grants — explicit, always (project rule)

This project's default privileges do NOT grant `service_role` DML or function
EXECUTE. Every migration MUST therefore grant `service_role` explicitly for
anything an Edge Function, cron job, or admin path touches:

```sql
-- service-role-only table
revoke all on <table> from anon, authenticated;
grant select, insert, update, delete on <table> to service_role;

-- client-readable table
grant select on <table> to authenticated;          -- RLS still filters rows
grant select, insert, update, delete on <table> to service_role;

-- security-definer function called by an Edge Function
revoke execute on function <fn> from anon, authenticated, public;
grant execute on function <fn> to service_role;
```

Two Phase 1 bugs traced to relying on implicit grants (`contact_hashes` DML and
`match_contact_hashes` EXECUTE). Never assume a default grant — write it.

## Regression testing (run before every phase merge)

```bash
supabase db reset            # clean apply of all migrations + seed
supabase test db             # pgTAP — every phase adds files; all must pass
./scripts/test-phase1.sh     # Phase 1 HTTP end-to-end (identity + contacts-match)
# (each phase adds its own scripts/test-phaseN.sh for HTTP/Edge flows)
```

pgTAP files live in `supabase/tests/NNNN_*_test.sql`. **Every migration phase
ships pgTAP coverage** — schema shape, constraints, privilege lockdown, and RPC
behaviour including typed error codes. Phase HTTP scripts cover Edge Functions
and real-token RLS that pgTAP cannot reach.

## Seed data strategy

- `supabase/seed.sql` is dev/CI only; each phase appends its section behind a
  `to_regclass()` guard so the file always runs cleanly regardless of how many
  migrations exist yet.
- Stable UUIDs (`...a000-00000000000N` users, `...b000-...` plans) so client
  fixtures and tests can reference them.
- Production gets NO seed beyond reference data (categories), which ships inside
  migration 0002 itself — not in seed.sql.
