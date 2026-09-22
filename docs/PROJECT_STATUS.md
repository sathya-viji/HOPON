# HopOn — Project Status & Handoff

Resume point for a fresh session. Read this + the docs linked below to get full
context.

_Last updated: 2026-09-22._

---

## Where we are

**All 7 canonical integration waves are COMPLETE**, plus Trust v2 and a
maintainability sprint. Backend + client are both feature-complete and
deployed to production. The repo has been dormant since the last commit
(`8f91ea2`, 2026-06-17) — nothing has changed since.

- **Backend:** 56 migrations in `supabase/migrations/` (through `0023`), 434+
  pgTAP assertions, 6 Edge Functions (`contacts-match`, `push-sender`,
  `chat-push`, `image-moderator`, `emergency-escalation`, `beta-auth`).
- **Client waves done:** Identity → core plan loop (Wave 2) → notifications/
  chat/realtime (Wave 3) → Trust v1 (Wave 4) → Trust v2 peer-corroborated
  attendance → Social (Wave 5) → onboarding-social/contacts (Wave 6) →
  Growth/invites+flags (Wave 7).
- **Maintainability sprint (2026-06-16):** dead code removed, `as any` casts
  typed, magic numbers → constants, `docs/TESTING.md` added. See
  `docs/MAINTAINABILITY_SPRINT_REPORT.md`.
- **Validation:** multi-user RLS/REST harness (67/67), local soak test (1k
  users / 50k messages, zero product defects). See
  `docs/VALIDATION_WAVES_1_5_1.md` and `hopon/_soak/REPORT.md`.
- **Production:** Supabase project `fxmxutwbdcrkcyedyfnm` is live. Verified
  2026-09-22 via `supabase migration list` — **all 56 local migrations are
  applied remotely, no drift.** 16 cron jobs, storage buckets, and all edge
  functions are deployed.

## Outstanding before public launch

These need Sathya's provider accounts/keys, not more code — see
`docs/ACCOUNTS_SETUP.md` / `docs/PROD_ENVIRONMENT_SETUP.md`:

1. **Remove the beta-auth backdoor.** `beta-auth` edge fn is still deployed
   and `eas.json` still sets `EXPO_PUBLIC_BETA_AUTH=true` for the `preview`
   build profile (confirmed live 2026-09-22). Fine for the 8-friend beta;
   must be deleted before a public build. Steps in `docs/PROD_ENVIRONMENT_SETUP.md`
   / prod-deploy notes: delete the `beta-auth` fn, unset `BETA_AUTH_CODE`,
   remove `EXPO_PUBLIC_BETA_AUTH` from `eas.json`, rebuild.
2. **Real Twilio SMS** for phone OTP (India DLT lead time — start early).
   Remove local `test_otp` numbers once live.
3. **Edge secrets:** `GOOGLE_VISION_KEY` (else moderation auto-approves),
   `EXPO_ACCESS_TOKEN` (else push silently no-ops), `TWILIO_*` +
   `FOUNDER_ALERT_PHONE`.
4. **Google Places key:** rotate (was pasted in chat once) and consider the
   `places-proxy` edge function so the key isn't in the client bundle.
5. **Physical-device EAS build** — push notifications, camera, and contacts
   are all untestable on the simulator.
6. **Post-deploy smoke test** — `docs/PROD_ENVIRONMENT_SETUP.md §9`.

## How to resume (local dev)

```bash
cd /Users/sathyaviji/Documents/HOPON_UI/hopon

# 1. Backend
supabase start                 # needs Docker running
supabase db reset              # apply all migrations + seed
supabase test db               # expect all pgTAP PASS

# 2. App (dev client already built with native modules)
npx expo start -c              # press i for iOS simulator
```

If you add a NEW native module: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`
(the UTF-8 locale avoids a CocoaPods `ASCII-8BIT` crash on this machine).

`.env.local` holds `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (from `supabase status`
for local, or the prod values for the deployed project). Untracked files
`.env.local.prod-backup` / `.env.local.prodbak` in the repo root hold prod env
backups — not committed, don't rely on them being current.

## Local test logins (after `supabase db reset`)

| Phone | Code | Result |
|---|---|---|
| 9999999991 | 123451 | registered (seed u0) → Home |
| 9999999992 | 123452 | registered (u1) |
| 9999999993 | 123453 | registered (u2) |
| 9999999900 | 123450 | NO profile → onboarding |

Phone auth works locally via a **dummy Twilio block + test_otp** in
`supabase/config.toml` (test numbers never hit Twilio).

## Key gotchas / decisions (don't relearn the hard way)

- **Native deps need a rebuild** — `npx expo run:ios` (this is a dev client, not
  Expo Go). Use the UTF-8 locale prefix above for pods.
- **Gender mapping**: UI shows male/female; backend enum is `man`/`woman`.
- **Auth gate reacts only to SIGNED_OUT**; sign-IN advances are explicit
  `refresh()` calls from screens.
- **Plan capacity includes the host slot**: `fn_sync_spots` reserves `-1` for
  the host — a cap-10 plan holds host + 9 joiners.
- **RPC-only mutations**, **explicit service_role grants**, **fix-forward
  migrations**, **pgTAP for every backend change** — maintain these.
- **gender/dob never leave the DB** (`users_public` excludes them).
- **`ALTER DATABASE`/`ALTER ROLE` are blocked on hosted Supabase** — runtime
  config (edge dispatch URL/key) lives in Vault, read via
  `vault.decrypted_secrets` (migration `0015e`).
- **`supabase functions deploy` hangs if Docker isn't running** — use
  `--use-api` to bundle server-side instead.

## Authoritative docs (read these for depth)

| Doc | What |
|---|---|
| `../hopon-backend-execution.md` | the frozen architecture/execution spec (source of truth) |
| `docs/INTEGRATION_PLAN.md` | client integration plan + the 7 waves |
| `docs/TRUST_V2_DESIGN.md` / `docs/TRUST_V2_REPORT.md` | peer-corroborated attendance model |
| `docs/NOTIFICATION_MATRIX.md` | notification types + classes |
| `docs/SOCIAL_GRAPH_MATRIX.md` | social interactions |
| `docs/SAFETY_INTERACTION_MATRIX.md` | safety model |
| `docs/MODERATION_STATUS_UX.md` | recap/story moderation UX contract |
| `docs/MAINTAINABILITY_SPRINT_REPORT.md` | 2026-06-16 cleanup pass |
| `docs/VALIDATION_WAVES_1_5_1.md` | multi-user validation harness + findings |
| `docs/PROD_ENVIRONMENT_SETUP.md` | prod deploy runbook + outstanding secrets |
