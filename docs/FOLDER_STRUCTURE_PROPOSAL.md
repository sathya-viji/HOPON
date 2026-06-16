# Folder Structure — Current State & Proposals
**Audit date:** 2026-06-16

---

## 1. Current Structure (Annotated)

```
src/
├── api/                        # All backend communication
│   ├── hooks/                  # Data-fetching hooks (useHomeFeed, usePlanDetail…)
│   ├── auth.ts                 # OTP auth + onboarding RPCs
│   ├── chat.ts                 # Chat send/read
│   ├── client.ts               # Supabase client singleton
│   ├── contacts.ts             # Contacts sync (Wave 6)
│   ├── errors.ts               # Error code → message mapping
│   ├── follows.ts              # Follow/unfollow/block
│   ├── growth.ts               # Invites + feature flags
│   ├── mappers.ts              # Backend row → view-model transforms
│   ├── notifications.ts        # Notification read/mark-read
│   ├── places.ts               # Google Places autocomplete
│   ├── plans.ts                # Plan CRUD + membership RPCs
│   ├── realtime.ts             # Supabase Realtime subscriptions
│   ├── recaps.ts               # Recap post/read/like/comment
│   ├── safety.ts               # Report/block
│   ├── social.ts               # Profile + familiar faces
│   ├── storage.ts              # Avatar/image upload (Supabase Storage)
│   ├── stories.ts              # Story post/view/delete
│   ├── trust.ts                # Endorse/attendance
│   └── users.ts                # Profile read/update/search
│
├── components/
│   ├── atoms/                  # Primitives: Button, Icon, T (typography), Avatar…
│   │   └── inputs/             # Form inputs: PhoneInput, OtpInput, SearchBar…
│   ├── layout/                 # Structural: Screen, Row, Stack, ScreenPad…
│   ├── molecules/              # Domain-aware composed components: PlanRow, NotifRow…
│   └── organisms/              # Complex context-aware: NavBar (legacy), FilterPills…
│
├── hooks/                      # Generic reusable hooks
│   ├── useBackHandler.ts       # ⚠️ UNUSED — delete
│   ├── useCountdown.ts         # Live countdown timer
│   ├── usePlanStatus.ts        # ⚠️ UNUSED — delete
│   ├── useTheme.ts             # ⚠️ REDUNDANT re-export — delete
│   └── useToast.ts             # Toast imperative API
│
├── mocks/                      # Static dev mock data
│   ├── index.ts
│   ├── notifications.ts
│   ├── plans.ts
│   ├── recaps.ts
│   ├── stories.ts
│   └── users.ts
│
├── navigation/                 # All navigator definitions
│   ├── AppTabBar.tsx           # Custom bottom tab bar
│   ├── HomeStack.tsx           # Home + plan + chat screens
│   ├── MainNavigator.tsx       # Tab navigator
│   ├── OnboardingNavigator.tsx # Onboarding stack
│   ├── ProfileStack.tsx        # Profile + social screens
│   ├── RecapsStack.tsx         # Recaps + stories screens
│   ├── RootNavigator.tsx       # Auth gate → Onboarding | Main
│   ├── transitions.ts          # Shared transition configs
│   └── types.ts                # All param list types
│
├── screens/                    # One file per screen
│   ├── _Placeholder.tsx        # ⚠️ DEAD — delete
│   ├── chat/
│   ├── home/                   # Home, Create, Search, LocSearch, Map, Empty
│   ├── notifications/
│   ├── onboarding/             # Login → OTP → Name → DOB → Gender → Photo → Neighbourhood → Interests → Contacts → PeopleToFollow
│   ├── plan/                   # Plan, PlanHost, PlanEdit, Endorse, PlanRequests…
│   ├── profile/                # Profile, ProfileOther, FamiliarFaces, FollowList…
│   ├── recaps/                 # Recaps, RecapDetail, RecapPost, StoryViewer…
│   └── settings/               # Settings, SettingsDelete, ReportForm, PushDebug…
│
├── services/
│   └── push.ts                 # Push notification registration
│
├── state/
│   ├── AuthContext.tsx          # Auth gate (session → onboarding | main)
│   ├── OnboardingDraftContext.tsx # Transient onboarding form state
│   ├── SessionContext.tsx       # Notification state + push registration
│   ├── pendingStory.ts          # Pending story bridge (useSyncExternalStore)
│   └── suspension.ts            # Account suspension flag (useSyncExternalStore)
│
├── theme/
│   ├── ThemeContext.tsx         # Light/dark mode context + useTheme
│   ├── index.ts                 # Re-exports
│   ├── textStyles.ts            # StyleSheet text style constants
│   └── tokens.ts                # All spacing, color, radii, typography tokens
│
├── types/                       # Domain type definitions
│   ├── chat.ts
│   ├── comment.ts
│   ├── follow.ts
│   ├── index.ts                 # Re-exports all types
│   ├── like.ts
│   ├── notification.ts
│   ├── plan.ts
│   ├── recap.ts
│   ├── report.ts
│   ├── story.ts
│   └── user.ts
│
└── utils/                       # Pure utility functions
    ├── avatar.ts                # Avatar URL + placeholder initial
    ├── plan.ts                  # Plan urgency, wrap-up state
    └── time.ts                  # timeAgo, minsUntil
```

---

## 2. Issues with Current Structure

### 2.1 `hooks/` Folder is Mostly Dead
Three of the five files in `src/hooks/` should be deleted (see `DEAD_CODE_REPORT.md`). Only `useCountdown.ts` and `useToast.ts` are actually used.

**Proposal:** Keep `src/hooks/` for generic cross-concern hooks. Move `api/hooks/` → `api/hooks/` (already correct placement for data hooks).

### 2.2 `mocks/` Should Be Dev-Only
The `mocks/` folder is still imported by two production components (`PlanRow.tsx`, `RecapCard.tsx`). Once those imports are removed, `mocks/` is a pure dev asset. Consider moving it to a `__mocks__/` directory or excluding it from production builds via Metro's `resolver.blockList`.

### 2.3 `screens/home/` Is Overloaded
`src/screens/home/` contains both the home feed screens AND the create plan screen, location search, and map — 6 files total. The create flow is semantically distinct from the home feed.

### 2.4 No `constants/` Directory
App-level constants (max plan lookahead, age minimums, etc.) are scattered across screen files as inline magic numbers. A `src/constants/` directory would centralise them.

---

## 3. Proposed Structure (Minimal — Low Disruption)

Only the changes worth making. All route names and imports stay the same.

```
src/
├── api/
│   └── hooks/                  # No change
├── components/                 # No change
├── constants/                  # NEW — extract magic numbers here
│   └── plan.ts                 # MAX_PLAN_LOOKAHEAD_DAYS, etc.
├── hooks/
│   ├── useCountdown.ts         # Keep
│   └── useToast.ts             # Keep
│   # REMOVE: useBackHandler.ts, usePlanStatus.ts, useTheme.ts
├── mocks/                      # Keep but remove from prod component imports
├── navigation/                 # No change
├── screens/
│   ├── home/
│   │   ├── HomeScreen.tsx
│   │   ├── HomeEmptyScreen.tsx
│   │   └── HomeMapScreen.tsx
│   ├── create/                 # NEW — move from home/
│   │   └── CreateScreen.tsx
│   ├── search/                 # NEW — move from home/
│   │   ├── SearchScreen.tsx
│   │   └── LocSearchScreen.tsx
│   ├── chat/                   # No change
│   ├── notifications/          # No change
│   ├── onboarding/             # No change
│   ├── plan/                   # No change
│   ├── profile/                # No change
│   ├── recaps/                 # No change
│   └── settings/               # No change
│   # REMOVE: _Placeholder.tsx
├── services/                   # No change
├── state/                      # No change
├── theme/                      # No change
├── types/                      # No change
└── utils/                      # No change
```

**Note:** Splitting `screens/home/` into `home/`, `create/`, and `search/` requires updating `HomeStack.tsx` import paths — a mechanical change with no logic risk. Navigation route names (`'Create'`, `'Search'`, `'LocSearch'`) stay unchanged.

---

## 4. Change Priority

| Change | Effort | Impact | Recommended |
|---|---|---|---|
| Delete 3 unused hook files | 5 min | Low risk, cleaner `hooks/` | ✅ Do it |
| Delete `_Placeholder.tsx` | 2 min | Low risk | ✅ Do it |
| Create `src/constants/plan.ts` | 15 min | Centralises magic numbers | ✅ Do it |
| Move Create/Search screens | 30 min | Cleaner structure, update imports | 🔵 Next sprint |
| Exclude `mocks/` from prod bundle | 1h | Reduces bundle size | 🔵 Next sprint |
| Full Atomic Design reorganisation | 4h+ | High disruption, low benefit now | ❌ Defer |
