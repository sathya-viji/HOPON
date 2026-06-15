# Wave 7 — Growth (invites + feature flags)

**Date:** 2026-06-15
**Status:** ✅ Implemented, type-clean, validated. `tsc --noEmit` exit 0;
**67/67** multi-user harness checks pass (added 5 growth checks); 434 pgTAP
unchanged (Phase 7 backend already shipped in migration 0012).

This is the last wave in the canonical rollout (INTEGRATION_PLAN §B.3: W1–W7).

---

## 1. Growth API — `src/api/growth.ts`
- **`inviteContacts()`** — reads contacts, normalises to `+E.164`, SHA-256-hashes
  client-side (same D10 privacy model as matching), calls `create_invites`.
  The RPC discards hashes that already belong to a HopOn user, so invites only
  land for non-members; returns the count created. Typed result
  (`sent | denied | no_contacts | error`); never throws.
- **`getInviteStats()`** — the signed-in user's invite counts (`pending` /
  `converted`) from their own `invites` rows (RLS-scoped).
- **`isFeatureEnabled(flag)`** — server-side flag check (applies per-user
  rollout-% bucketing); defaults false on error so gated features stay off.
- **`useFeatureFlag(flag)`** hook (`src/api/hooks/useFeatureFlag.ts`) — `{enabled, loading}`.

## 2. Surfaced
- **Settings → GROW → "Invite friends"** — triggers `inviteContacts`, toasts the
  count ("Invited N friends" / "all your contacts are already on hopon"), and the
  row sub-label shows live `N joined · M pending` from `getInviteStats`.
- **Onboarding (PeopleToFollow)** — after contact matching, an "Invite friends
  not on hopon" CTA (shown when the user opted into contact sync).
- **Feature-flag gating** — `useFeatureFlag` is ready to gate any screen/feature;
  no flags are seeded yet (none needed today), so nothing is gated. When product
  wants to gate something, wrap it in `useFeatureFlag('name')` and add the row to
  `feature_flags`.

Conversion loop closes automatically: when an invited contact signs up,
`complete_signup` converts the pending invite and credits the inviter (backend,
since Phase 1).

## 3. Validation
- **Harness (`validate_multiuser.mjs` §12):** `create_invites` invites 1 of 2
  hashes (the member is excluded); pending invite row created; unknown flag →
  false; enabled-100% flag → true; disabled flag → false. **67/67 pass.**
- **`tsc --noEmit`** exit 0. `ExpoContacts`/`ExpoCrypto` linked (Podfile.lock).

## 4. Status of the rollout (all 7 waves)
| Wave | Status |
|---|---|
| W1 Identity · W2 Core loop · W3 Realtime · W4 Trust · W5 Social · W5.1 backend gaps | ✅ |
| W6 Safety | ✅ (gate 61/61) |
| **W7 Growth** | ✅ (this report) |

**All planned waves are complete.**

## 5. Remaining (not waves — cross-cutting / ops)
- **Suspended-state banner (A.8):** a global read-only banner for suspended
  users is NOT built. Blocker: the client can't read its own `account_status`
  (not exposed in `users_public`/the column grant). Two options need a call:
  (a) expose `account_status` to self in `users_public` (small backend change),
  then show a banner; or (b) drive a reactive banner off caught `account_suspended`
  errors (client-only). Enforcement itself is proven (W6 gate). Flagged for decision.
- **Launch hardening (ops):** prod `edge_base_url`/service-role/Twilio secrets,
  cron scheduling verification, push on a real device build, `__DEV__`-gate the
  dev-gear FAB, `ProfileIncomplete` decorative avatars. Gates "works locally" →
  "works in production."
