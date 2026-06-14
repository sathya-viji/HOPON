# Wave 2 — Core Plan Loop · Integration Report

**Date:** 2026-06-14
**Scope:** Wire the core plan loop screens off `src/mocks/*` onto the frozen
backend RPCs (discovery, detail, membership, host mutations). No backend, UI,
or auth-architecture changes.

---

## 1. Status: ✅ Complete

The full plan loop is integrated and verified on the iOS simulator against a
freshly-seeded local Supabase. TypeScript typechecks clean (`tsc --noEmit`,
exit 0). No blocking issues found.

---

## 2. What was wired

### API layer (`src/api/`)
- **`plans.ts`** — `getHomeFeed`, `searchPlans`, `getPlanDetail`, `joinPlan`,
  `leavePlan`, `createPlan`, `updatePlan`, `cancelPlan`, `approveRequest`,
  `declineRequest`, `getPlanMembers`. All mutations are RPC-only; reads go
  through the security-definer discovery RPCs (`get_home_feed`,
  `get_plan_detail`) or host-RLS table reads (`plan_members` + `users_public`).
- **`mappers.ts`** — `mapFeedItemToPlan`, `mapPublicUser`, `mapPlanDetail`
  (snake_case rows → camelCase view-models; derives `minutesUntilStart`,
  `isMine`, `viewerJoined`, host summary, joiner summaries).
- **`users.ts`** — `getMyProfile` for the PlanRequested TrustGrid.
- **`storage.ts`** — `avatarUrl(path)` → Supabase public URL.
- **Hooks** — `useHomeFeed` (focus-refetch: first focus = load, later focuses =
  silent refresh), `usePlanDetail`, `usePlanMembers` (focus-refetch).

### Screens refactored mock → real
| Screen | RPC(s) | Notes |
|---|---|---|
| Home feed | `get_home_feed` | NOW/LATER grouping, YOURS/HOP ON, joined/created tabs |
| Plan detail | `get_plan_detail`, `join_plan` | footer branches on host/joined/requested/full |
| PlanJoined / PlanRequested | `get_plan_detail`, `get_my_profile` | confirmation + withdraw (`leave_plan`) |
| PlanLeaveConfirm / PlanCancelConfirm | `leave_plan` / `cancel_plan` | busy guard, `popToTop` on success |
| Create (3-step) | `create_plan` | capacity incl. host, 14-day window, `→ PlanPosted` |
| PlanHost | `get_plan_detail`, `getPlanMembers` | attendees / pending split |
| PlanRequests | `approve_request` / `decline_request` | TrustPills, refetch on decide |
| PlanEdit | `update_plan` | capacity stepper removed (RPC has no capacity param) |
| Search | `search_plans` (typing) / `get_home_feed` (browse) | category server-side, time client-side |
| HomeMap | `get_home_feed` | geo pins off real feed |

---

## 3. On-device verification (u1 / Arjun, fresh seed)

| Flow | RPC | Result |
|---|---|---|
| Home feed renders | `get_home_feed` | ✅ NOW/LATER groups, YOURS/HOP ON badges, counts |
| Open plan detail | `get_plan_detail` | ✅ host card, joiners count, description |
| Join open plan | `join_plan` | ✅ "You're in!" → PlanJoined |
| Join women-only as man | `join_plan` | ✅ toast "This plan is limited to a different group." (no nav) |
| Leave joined plan | `leave_plan` | ✅ confirm → popToTop → feed flips back to HOP ON |
| Create plan (3 steps) | `create_plan` | ✅ "Plan is live!" → host view, Created count bumps |
| Host view of own plan | `get_plan_detail` | ✅ viewer_is_host branch (Chat/Edit/Cancel, attendees) |
| Full-text search | `search_plans` | ✅ "Coffee" returns the match |
| Focus-refetch | — | ✅ feed reflects join/leave/create on return |

**Code-complete & tsc-clean, not re-clicked on-device** (identical RPC-wrapper +
toast + refetch pattern as the verified flows; lower risk):
`cancel_plan`, `approve_request` / `decline_request`, `update_plan`, HomeMap geo.

---

## 4. Flagged items (need product decisions — not blocking the loop)

1. **Geocoding is scaffolded.** `create_plan` / `update_plan` require `lat`/`lng`,
   but `LocSearchScreen` is a hard-coded Bangalore place list with approximate
   coords (clearly marked `SCAFFOLD`). **Production needs a real geocoder**
   (Google/Mapbox Places) to turn a picked place into coordinates. Until then,
   created plans cluster on the mock coordinates.

2. **No people search.** There is no `search_users` RPC, so Search is
   **plans-only**. The search bar placeholder still says "…people"; either ship a
   `search_users` RPC (backend, out of Wave 2 scope) or trim the copy.

3. **PlanPosted body copy is static.** It always reads "visible to everyone in
   **HSR Layout**" regardless of the chosen location. Cosmetic string fix in
   `PlanPostedScreen` (no integration impact).

---

## 5. Intentionally left as mock (later waves)

- **PlanApproved / PlanDeclined / PlanExpired** — notification-driven, **Wave 3**.
- **PlanEnded / Endorse** — `end_plan` + endorsements are **Wave 4 (Trust)**.
- **Avatar upload, Contacts sync** — explicitly out of scope (per hardening-pass
  constraints).

---

## 6. Backend deltas absorbed (no contract changes)

- `update_plan` has **no capacity param** → capacity stepper removed from PlanEdit.
- `get_plan_detail.host` is a **full `users_public` row** → `mapPublicUser`.
- `familiar_count` / mutual faces are **Phase 4** → FamiliarFaces banner shows
  `faces={[]}`; PlanRequests drops the mutual pill.
- Pending requests have no read RPC → read `plan_members` via host RLS +
  `users_public`.

---

## 6b. Post-Wave-2 flagged-issue fixes (2026-06-14)

Addressing the three items flagged in §4. Decisions made by the founder.

1. **People search — BUILT.** New additive read RPC `search_users(p_query, p_cursor)`
   (`migrations/..._0014o_search_users.sql`) — queries the `users_public` view so
   all privacy (block-pairs, profile_visibility) is inherited; matches name
   (trgm) + `@handle` (prefix), excludes self, ≥2-char guard, `not_authenticated`
   raise; `SECURITY DEFINER`, granted authenticated+service_role. 12 pgTAP
   assertions in `tests/0019_search_users_test.sql` (368 total, all pass).
   Client: `searchUsers()` in `api/users.ts`; a reusable `PersonRow` molecule;
   a **PEOPLE** section added to the **Home inline search** (the prototype's real
   search surface — the dedicated `SearchScreen` is unreachable/orphaned, so
   People live where users actually type). People fetch is server-side + debounced;
   plans stay client-filtered as before. Device-verified (search "Priya" → result
   row with inline verified badge → taps through to the profile route).
   - **UI note:** this is a *new* layout (no prototype equivalent) — approved by
     the founder. Inline verified check uses the `badge-check` Icon (the
     `VerifiedBadge` atom is an absolute avatar-corner overlay, wrong for inline).
   - **Still mock (later wave):** `ProfileOther` renders static data regardless of
     `userId` — Social-wave wiring, out of scope here.

2. **Geocoding — DONE (Google Places New).** Key in `.env.local` as
   `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` (gitignored; restrict to Places API + add
   an Edge Function proxy before scale — flagged). New `api/places.ts`:
   `placesAutocomplete` + `placeDetails` (REST, session-token billing, Bangalore
   `locationBias`). LocSearch rewritten — real debounced autocomplete (≥2 chars),
   Place Details → exact lat/lng on pick; scaffold place-list removed. "Near me"
   now uses real device GPS via `expo-location` (`requestForegroundPermissions` +
   `getCurrentPositionAsync` + `reverseGeocodeAsync` for the label; Info.plist
   string already present, no rebuild). Stored label = prediction main text.
   Device-verified: "Indira" → live Bangalore results → picked Indiranagar →
   created plan persisted **real coords 12.97837, 77.64084**. GPS "Near me" also
   device-verified with a simulated location (12.9352, 77.6245 → reverse-geocoded
   to "Koramangala", coords persisted exactly).

3. **PlanPosted copy — FIXED.** `create_plan` now passes the location label to
   PlanPosted (`navigation/types` param + CreateScreen). `areaFromLabel()` shows
   the area after the last comma (e.g. "Cubbon Park, Central Bangalore" →
   "Central Bangalore"), with a generic fallback. Device-verified.

## 7. Notes for next session

- Local seed (`seed.sql`) uses **relative `now() + interval` start times** that
  drift into the past between sessions; `supabase db reset` reseeds with fresh
  future-dated plans. DB was reset clean at end of this session.
- Simulator hardware-keyboard `type` drops characters intermittently in RN
  `TextInput`; per-key `key` presses are reliable.
