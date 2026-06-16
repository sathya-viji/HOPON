# Testing Guide
**Scope:** HopOn backend (Supabase) — pgTAP unit tests + integration harnesses  
**Frontend:** TypeScript type checking only (no component test suite yet)

---

## 1. Test Layers

| Layer | Location | What it covers |
|---|---|---|
| pgTAP unit tests | `supabase/tests/*.sql` | Schema constraints, RPC behaviour, RLS rules, per-row isolation — 434+ assertions |
| Phase integration scripts | `scripts/test-phase*.sh` | End-to-end HTTP flows against the local stack for each feature wave |
| Multi-user validation harness | `scripts/validate_multiuser.mjs` | Cross-user RLS, visibility, and RPC correctness across 6 seeded users |
| TypeScript compiler | `npx tsc --noEmit` | Frontend type correctness (no runtime test suite) |

---

## 2. Prerequisites

```bash
# Start the local Supabase stack
supabase start

# Apply all migrations from scratch
supabase db reset

# Verify the stack is running
supabase status
```

> **Important:** `supabase test db` does NOT apply new migrations before running. Always run `supabase db reset` first to ensure a clean baseline when adding or modifying migrations. See `docs/BACKEND_DEV.md` for the full migration workflow.

---

## 3. Running pgTAP Tests

```bash
# All 23 test files
supabase test db

# Single file
supabase test db supabase/tests/0001_schema_phase1_test.sql
```

All 23 test files must pass with zero failures. The test output is TAP (Test Anything Protocol) format — look for `# Planned X tests` and `ok N - description` lines.

### Test file structure

Each test file covers one feature phase:

| File | Covers |
|---|---|
| `0001_schema_phase1_test.sql` | Identity schema — users, handles, phone verification |
| `0002_rpc_phase1_test.sql` | `complete_signup`, `contacts_match` RPCs |
| `0003-0004` | Auth + contacts (Phase 2) |
| `0005-0006` | Plans schema + `create_plan`, `join_plan`, `leave_plan` (Phase 3) |
| `0007-0010` | Social graph, plan members, messaging (Phases 4–5) |
| `0011-0012` | Recaps, stories, trust (Phase 6) |
| `0013` | Penetration checks — RLS boundary tests |
| `0014` | Phase 7 RPCs (`endorse`, `mark_attendance`) |
| `0015-0020` | Per-content reporting, interests, search, plan members (Waves 5–7) |

---

## 4. Phase Integration Scripts

These scripts drive the real HTTP/REST API (PostgREST + Auth) against the local stack, testing the API as the mobile app would call it.

```bash
# Phase 1 — identity flow
./scripts/test-phase1.sh

# Phase 2–7 (same pattern)
./scripts/test-phase2.sh
./scripts/test-phase7.sh
```

Each script:
1. Creates a fresh auth user
2. Signs in and obtains a real JWT
3. Calls RPCs via REST exactly as the mobile app does
4. Asserts response shape, status codes, and data-isolation guarantees
5. Exits non-zero on any failure

---

## 5. Multi-User Validation Harness

The most comprehensive test. Runs 60+ scenarios across 6 seeded users to validate cross-user RLS, visibility rules, and follow/block/trust semantics.

```bash
# Clean baseline required
supabase db reset
node scripts/validate_multiuser.mjs
```

The seeded users (UUIDs in `scripts/validate_multiuser.mjs`):

| Alias | Handle | Notes |
|---|---|---|
| `you` | `@you` | The primary test actor |
| `arjun` | `@arjun.blr` | Mutual follower, trusted |
| `priya` | `@priya.bang` | Follower only |
| `kiran` | `@kiran.h` | No relationship |
| `sneha` | `@sneha.k` | Blocked by `you` |
| `dev` | `@dev.test` | Admin-seeded moderator |

See `docs/VALIDATION_WAVES_1_5_1.md` for the full scenario list and expected outcomes.

---

## 6. TypeScript Type Check

```bash
npx tsc --noEmit
```

Must pass with zero errors before any PR. This is the only frontend compile check — there is no Jest/Vitest test suite for components.

---

## 7. Adding New pgTAP Tests

1. Create `supabase/tests/NNNN_<feature>_test.sql` (next sequential number)
2. Follow the existing pattern:
   ```sql
   BEGIN;
   SELECT plan(N);  -- declare how many assertions

   -- schema checks
   SELECT has_table('public', 'my_table', 'table exists');
   SELECT col_not_null('public', 'my_table', 'id', 'id is not null');

   -- RLS checks (as a specific role)
   SET LOCAL ROLE authenticated;
   SET LOCAL "request.jwt.claims" TO '{"sub": "uuid-here", "role": "authenticated"}';
   SELECT results_eq(
     $$ SELECT count(*)::int FROM my_table WHERE ... $$,
     ARRAY[1],
     'user sees their own row'
   );

   SELECT * FROM finish();
   ROLLBACK;
   ```
3. Run `supabase db reset && supabase test db` to verify
4. Add a row for the new file to the table in §3 of this doc

---

## 8. What Is Not Tested

| Gap | Impact | Notes |
|---|---|---|
| Push notification delivery | Low | Manual device testing only |
| Real-time subscription payloads | Low | Tested implicitly via integration scripts |
| Frontend component rendering | Medium | No UI test suite; relies on TypeScript + manual QA |
| Edge function cold-start latency | Low | Measured during soak test; see `docs/_soak/` |

The largest coverage gap is frontend components — no Jest or Detox test suite exists. UI correctness relies on TypeScript strict mode + manual device testing against the staging stack.
