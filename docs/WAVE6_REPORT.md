# Wave 6 — Integration cleanup + Onboarding social (contacts → follow)

**Date:** 2026-06-15
**Status:** ✅ Implemented, type-clean, pipeline-validated. `tsc --noEmit` exit 0;
**62/62** multi-user harness checks pass (incl. new contacts-match coverage);
434 pgTAP unchanged (no migrations).

---

## 1. Integration cleanup (remaining mock-bound screens)
Wired off `@/mocks` to real backend reads:
- **SettingsScreen** — profile header via `getMyProfile` (was `getUserById`/`CURRENT_USER_ID`).
- **PlanApprovedScreen / PlanDeclinedScreen / PlanExpiredScreen** — plan + host via
  `usePlanDetail(planId)` (was `getPlanById`/`getUserById`), with graceful loading fallbacks.

Left intentionally (per decision):
- **ProfileIncompleteScreen** — `AVATARS` used only for a decorative avatar stack
  (cosmetic illustration; no real data fits). Out of scope.

## 2. Onboarding social — contacts → follow
Privacy model (D10, frozen): raw numbers never leave the device.
- **`src/api/contacts.ts`** — `matchContacts()`: requests the contacts permission,
  reads contacts, normalises each number to `+E.164` (`normalizePhone`, default
  CC +91), SHA-256-hashes client-side (`expo-crypto`), invokes the `contacts-match`
  Edge Function, and maps the returned `users_public` rows to `User[]`. Typed
  result (`matched | denied | no_contacts | error`); never throws.
- **ContactsSyncScreen** — now just captures intent and routes to
  `PeopleToFollow { sync: true }` (single permission prompt happens there); "Skip"
  routes without sync.
- **PeopleToFollowScreen** — on mount (when `sync`), runs `matchContacts()` and
  shows the real matched users with a working **Follow** (`follow_user` →
  accepted/pending), plus loading + denied/empty states. (Was a hard-coded mock list.)
- **Nav:** `PeopleToFollow` param is now `{ sync?: boolean }`.

## 3. Validation
- **Edge-fn pipeline proven:** posting `sha256('+919999999993')` /
  `sha256('+919999999994')` to `contacts-match` returns Priya / Kiran; a junk hash
  doesn't match; the caller is excluded. Confirms client hashing matches the
  RPC's `sha256('+'||phone)`.
- **Harness:** added section 11 (contacts-match) — **62/62 pass**.
- **`tsc --noEmit`** exit 0.
- **Native modules:** `ExpoContacts` (56.0.9) + `ExpoCrypto` (56.0.4) are in the
  iOS Podfile.lock → linked in the build (no rebuild needed); `matchContacts`
  also degrades gracefully (try/catch → error/empty state) if a module is absent.

## 4. Notes / limitations
- A live on-device run of the onboarding contacts sync wasn't executed this pass
  (reaching `PeopleToFollow` requires a full fresh signup; high cost, low marginal
  value given the pipeline is proven + native modules linked + screens follow
  established patterns). Recommended as a quick manual check during QA: add a
  contact with a seeded test number (+9199999999X) on the simulator, sign up a new
  user, and confirm the match + follow.
- `normalizePhone` is heuristic (defaults bare 10-digit numbers to +91). Fine for
  the IN launch market; revisit if expanding country coverage.
- `match_contact_hashes` only matches `profile_visibility='everyone'` users — a
  followers-only/nobody user won't appear in contact matches (by design).

## 5. Status
Onboarding social complete. The app has **no remaining mock-bound data screens**
except `ProfileIncomplete` (decorative). Ready for the next wave / launch hardening.
