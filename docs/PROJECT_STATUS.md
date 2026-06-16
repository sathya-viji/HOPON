# HopOn — Project Status & Handoff

Resume point for a fresh session. Read this + the docs linked below to get full
context. Everything is on disk (no git remote; same machine).

_Last updated: 2026-06-16._

---

## Maintainability Sprint (2026-06-16) — COMPLETE

A zero-behavior-change maintainability pass over Waves 1–7. Tagged
`maintainability-sprint-2026-06-16`. See `docs/MAINTAINABILITY_SPRINT_REPORT.md`
for the full report and `docs/MAINTAINABILITY_PLAN.md` for the phase plan.

- **Dead code removed:** 3 unused hooks, `_Placeholder.tsx`, 3 `.DS_Store` files,
  mock imports purged from `PlanRow`/`RecapCard`, `react-native-maps` dropped.
- **Type safety:** 14 `as any` cast sites replaced with documented type aliases;
  `FadeUp` style prop typed.
- **Consistency:** `hitSlop` → `spacing` tokens; magic numbers → `src/constants/plan.ts`
  + `MS_PER_YEAR`; push logs guarded with `__DEV__`.
- **Docs:** new `docs/TESTING.md`; `FOLDER_STRUCTURE.md` refreshed.
- **Validation:** `npx tsc --noEmit` clean after every phase.
- **Known debt deferred (needs behavior change):** `getUserHostedPlans` throws
  42501 — needs a `get_user_plans` SECURITY DEFINER RPC. See sprint report §Remaining.

---

## Where we are

**Backend: COMPLETE through the frozen execution doc (Phases 1–7 + safety).**
- 40 migrations in `supabase/migrations/`, **356 pgTAP assertions passing**, zero
  schema drift, lint clean.
- 5 Edge Functions: `contacts-match`, `push-sender`, `chat-push`,
  `image-moderator`, `emergency-escalation`.
- 7 phase regression scripts: `scripts/test-phase{1..7}.sh`.

**Client integration: IN PROGRESS — Identity wave (Wave 1) DONE.**
- `src/api/` foundation: `client.ts`, `auth.ts`, `errors.ts`.
- Auth gate: `src/state/AuthContext.tsx` drives Onboarding vs Main from
  session + profile; `RootNavigator` switches stacks on `status`.
- Wired screens: Login, SignupPhone, SignupOtp, SignupName (+ live username
  check, no auto-handle), SignupDob, SignupGender, Interests, Neighbourhood
  (completeSignup finale), Settings (logout), SettingsDelete (delete_account).
- Onboarding draft: `src/state/OnboardingDraftContext.tsx`.

**NEXT: Wave 2 — core plan loop** (Home feed → Plan detail → join), wiring
`get_home_feed` / `get_plan_detail` / `join_plan`. Start with Home, stop for review.

See `docs/INTEGRATION_PLAN.md` for the full screen-by-screen plan and the 7 waves.

---

## How to resume (local dev)

```bash
cd /Users/sathyaviji/Documents/HOPON_UI/hopon

# 1. Backend
supabase start                 # needs Docker running
supabase db reset              # apply all migrations + seed
supabase test db               # expect 356/356 PASS

# 2. App (dev client already built with native modules)
npx expo start -c              # press i for iOS simulator
```

If you add a NEW native module: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`
(the UTF-8 locale avoids a CocoaPods `ASCII-8BIT` crash on this machine).

`.env.local` holds `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (from `supabase status`).
It's gitignored-style/local; if missing, recreate from `supabase status -o json`.

---

## Local test logins (after `supabase db reset`)

| Phone | Code | Result |
|---|---|---|
| 9999999991 | 123451 | registered (seed u0) → Home |
| 9999999992 | 123452 | registered (u1) |
| 9999999993 | 123453 | registered (u2) |
| 9999999900 | 123450 | NO profile → onboarding |

Phone auth works locally via a **dummy Twilio block + test_otp** in
`supabase/config.toml` (test numbers never hit Twilio).

---

## Key gotchas / decisions (don't relearn the hard way)

- **Native deps need a rebuild** — `npx expo run:ios` (this is a dev client, not
  Expo Go). Use the UTF-8 locale prefix above for pods.
- **Gender mapping**: UI shows male/female; backend enum is `man`/`woman`. The
  gender screen maps it. This matters for D11 gender-matched plan joins.
- **Auth gate reacts only to SIGNED_OUT**; sign-IN advances are explicit
  `refresh()` calls from screens (so signup can show "already registered"
  before jumping to Home).
- **Pre-OTP checks**: `phone_has_profile` (signup blocks registered numbers /
  login catches unknown ones, both stay on screen + show a cross-link) and
  `handle_available` (live username check on the name screen).
- **complete_signup** needs name, handle (with `@`), dob (YYYY-MM-DD local),
  gender (backend value), neighbourhood. Interests saved separately via a
  whitelisted `users.interests` UPDATE.
- **RPC-only mutations**, **explicit service_role grants**, **fix-forward
  migrations**, **pgTAP for every backend change** — maintain these.
- **gender/dob never leave the DB** (users_public excludes them). Don't expose.

---

## Authoritative docs (read these for depth)

| Doc | What |
|---|---|
| `../hopon-backend-execution.md` | the frozen architecture/execution spec (source of truth) |
| `docs/INTEGRATION_PLAN.md` | client integration plan + UI impact + the 7 waves |
| `docs/NOTIFICATION_MATRIX.md` | 41 notification types + classes |
| `docs/SOCIAL_GRAPH_MATRIX.md` | social interactions |
| `docs/SAFETY_INTERACTION_MATRIX.md` | safety model (all 8 items resolved) |
| `docs/MODERATION_STATUS_UX.md` | recap/story moderation UX contract |
| `docs/BACKEND_DEV.md` | local dev workflow, migration/rollback, secrets |
| `docs/PHASE5_IMPACT.md` | multi-image recap decision |

## Open follow-ups (not blockers)
- Avatar upload (SignupPhoto) + contacts-match wiring (post-profile) — later wave.
- Handle collision in onboarding shows an error; production could auto-suffix.
- Production: set edge GUCs (`app.settings.edge_base_url` + service key), enable
  pg_cron, real Twilio/Vision keys, PITR. CI (`.github/workflows/`) needs a
  GitHub remote + secrets to run.
