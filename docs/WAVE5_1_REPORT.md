# Wave 5.1 — Backend Gap Closure Report

**Date:** 2026-06-15
**Scope:** The two backend gaps flagged in `docs/WAVE5_REPORT.md` — nothing else.
Both were integration/backend gaps (not new product behavior).

**Status:** ✅ Both fixed, tested, and **device-verified end-to-end**.
`tsc --noEmit` exit 0 · **434 pgTAP pass** (417 prior + 17 new) · clean `db reset`.

---

## 1. What changed

### Gap #2 — storage uploads (RLS)
- **`supabase/migrations/20260616000000_0014t_storage_rls.sql`** — adds own-folder
  write policies on `storage.objects` for the `avatars` / `recaps` / `stories`
  buckets (INSERT / UPDATE / DELETE, gated to `(storage.foldername(name))[1] =
  auth.uid()`). Public READ already worked (buckets are public). Mirrors the
  standard Supabase own-folder pattern; the client already uploads to
  `${auth.uid()}/<file>`.
- **`src/api/storage.ts`** — fixed the client upload helper: it now uploads the
  raw **ArrayBuffer** (from `fetch(uri).arrayBuffer()`) with an explicit
  image content-type, instead of an RN `Blob`. RN Blobs from `fetch` upload an
  empty/invalid body via supabase-storage-js — the ArrayBuffer path is the
  reliable, dependency-free fix. (Client integration bug, not a backend change.)

### Gap #1 — "my plans" read path
- **`supabase/migrations/20260616000001_0014u_get_my_plans.sql`** — adds a
  minimal SECURITY DEFINER `get_my_plans()` returning the caller's hosted +
  member plans (newest-started first). Needed because direct `plans` /
  `plan_members` selects fail for `authenticated` with 42501 (users-column
  cascade); all plan reads go through definer RPCs. Same pattern as
  `get_plan_attendees`. Grants: authenticated + service_role only.
- **`src/api/plans.ts`** — `getMyPlans()` now calls `rpc('get_my_plans')`
  (one call; mappers unchanged).

### Tests
- **`supabase/tests/0023_wave5_1_storage_my_plans_test.sql`** (17 assertions):
  - get_my_plans: host sees both hosted plans; member sees only joined; loner
    sees none; ordering soonest-started-last; grants (authenticated yes / anon no).
  - storage RLS: the 3 policies exist; own-folder insert allowed (recaps +
    avatars); other-user-folder insert blocked (42501) — run under `set role
    authenticated` so RLS is actually enforced.

---

## 2. Validation
- `supabase db reset` — all migrations (incl. 0014t, 0014u) apply cleanly; buckets re-provision.
- `supabase test db` — **434 pass** (Files=23), including the 17 new Wave 5.1 assertions.
- `tsc --noEmit` — exit 0.
- **Direct REST probes (Arjun JWT):** own-folder image upload → HTTP 200; other-folder → 403.

## 3. Device re-test (iOS simulator, Arjun)
- **Image upload:** posted a recap with a real photo → object stored in `recaps`
  bucket as a **2.8 MB image/jpeg** (not an empty blob). ✅
- **Recap creation:** `post_recap` succeeded → "Recap shared! It's in review";
  after `approve_recap`, the card renders in the feed ("NEAR YOU") with the
  uploaded image resolving via the public URL. ✅
- **Plan picker:** RecapPost now lists the eligible started plan ("Badminton ·
  Play Arena") via `get_my_plans`. ✅
- **Profile Hosted/Joined tabs:** now populate — **Hosted · 1** (Badminton,
  "completed"), **Joined · 0**, **Recaps · 1**. ✅
- (Earlier, pre-fix, the same story-post reproduced the 403 — confirming the fix
  is what unblocked it.)

## 4. Notes / out of scope (unchanged from Wave 5)
- **ProfileOther (other users') Hosted tab** still uses `getUserHostedPlans`,
  which remains empty — populating another user's plans would need a separate
  `get_user_plans(p_user_id)` RPC. Out of scope here ("current user's plans" only);
  left as a documented, non-blocking limitation.
- **Blocked-user names** (Gap #3, MEDIUM) — unchanged; SettingsBlocked still
  shows generic rows. Not part of these two fixes.
- Local-dev artifacts from testing: one backdated seed plan and two orphaned
  storage objects (guarded by `storage.protect_delete`); a `supabase db reset`
  restores a pristine state.

## 5. Launch-readiness (Waves 1–5)
- Waves 1–4 + Trust v2: ✅ (434 pgTAP green).
- Wave 5 (all surfaces incl. image upload + recap creation + plan-history): ✅ READY.
- The two previously-blocking gaps are closed; no remaining Critical/High items.
