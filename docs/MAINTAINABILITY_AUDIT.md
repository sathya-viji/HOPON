# Maintainability Audit
**Audit date:** 2026-06-16 · **Scope:** `src/` — all TypeScript/TSX files

---

## 1. Type Safety — `as any` / unsafe casts

| File | Lines | Issue | Fix |
|---|---|---|---|
| `src/navigation/AppTabBar.tsx` | 10, 36, 42, 47 | `state: any` in `getDeepestRouteName` + three `(navigation as any).navigate(...)` casts | Type `state` as `PartialState<NavigationState>` from `@react-navigation/native`; use `useNavigation<RootParamList>()` typed hook for cross-stack navigation |
| `src/screens/home/LocSearchScreen.tsx` | 61–63 | Three `(navigation as any).popTo(...)` calls — `popTo` is RN7 but not yet typed | Add `declare module` augmentation or cast to the specific typed navigator |
| `src/screens/notifications/NotificationsScreen.tsx` | 100, 148 | `(navigation as any).navigate(...)` and `(navigation.getParent() as any)?.navigate(...)` | Use `useNavigation<HomeStackParamList>()` and properly type cross-stack via `CompositeNavigationProp` |
| `src/screens/plan/PlanEndedScreen.tsx` | 81 | `(navigation.getParent() as any)?.navigate(...)` to RecapsTab | Same — `CompositeNavigationProp` |
| `src/api/realtime.ts` | 28 | `payload.new as any` passed to `mapMessageRow` | Type `payload.new` as `MessageRow` (the row shape is known) |
| `src/components/atoms/FadeUp.tsx` | 14 | `style?: any` on props interface | Use `StyleProp<ViewStyle>` |
| `src/screens/home/HomeMapScreen.tsx` | 61–64, 83 | Percentage strings cast `as any` for RN style `top`/`left` | Use `DimensionValue` or restructure to use `Animated` percentage-based layout |

**Count: 7 files, 14 cast sites.** None are dangerous at runtime, but they suppress compiler errors that could catch future regressions.

---

## 2. Silent `.catch(() => {})` — Swallowed Errors

These catch handlers discard errors with no user feedback and no logging. If the underlying operation silently fails, the user sees stale/empty data with no indication.

| File | Pattern | Risk |
|---|---|---|
| `src/screens/settings/SettingsScreen.tsx` | `.catch(() => {})` on `getMyProfile` and `getInviteStats` | Medium — settings page shows stale data silently |
| `src/screens/profile/FamiliarFacesScreen.tsx` | `.catch(() => { /* keep empty */ })` | Low — empty state shown, acceptable |
| `src/screens/plan/PlanScreen.tsx` | `.catch(() => { /* banner stays hidden */ })` | Low — banner is supplementary |
| `src/screens/chat/ChatScreen.tsx` | `.catch(() => { /* offline */ })` | Low — documented intent, acceptable |
| `src/screens/recaps/StoryViewerScreen.tsx` | `recordStoryView(...).catch(() => {})` | Low — view recording is best-effort |

**Recommendation:** Replace empty `.catch(() => {})` in SettingsScreen with at minimum a console.warn in dev mode, so failures are visible during development.

---

## 3. `console.log` / `console.warn` in Production Code

| File | Lines | Call | Action |
|---|---|---|---|
| `src/api/client.ts` | 54 | `console.warn('[auth] AsyncStorage...')` | Keep — it's a developer diagnostic that fires only when the native module is missing (rare, intentional) |
| `src/services/push.ts` | 85, 168, 170, 173 | `console.log/warn '[push]...'` | Wrap in `if (__DEV__)` — push registration logs will appear for every beta user |
| `src/components/layout/ErrorBoundary.tsx` | 21 | `console.error('[ErrorBoundary]', ...)` | Keep — error boundaries should always log to an error reporter; wire to a crash-reporting SDK (Sentry etc.) before public launch |

---

## 4. Duplicate `getMyProfile` Calls Across Screens

`getMyProfile()` is called independently in **8 different screens** (SettingsScreen, ProfileScreen, ProfileRequestedScreen, RecapPostScreen, RecapsScreen, CreateStoryScreen, and others), each owning their own `[me, setMe]` local state. This means the same network request fires on every tab focus, and the signed-in user's profile can be inconsistent between screens mid-session.

**Recommendation:** Lift `myProfile` into `SessionContext` alongside notifications. One load on login, one realtime-gated refresh. Screens read `const { me } = useSession()`.

---

## 5. Inconsistent Navigation Casting Pattern

Cross-stack navigation is handled three different ways:

1. `(navigation as any).navigate('RecapsTab', { screen: 'RecapPost', ... })` — in PlanEndedScreen, NotificationsScreen
2. `(navigation.getParent() as any)?.navigate(...)` — same screens
3. `useNavigation<CompositeNavigationProp<...>>()` — not used anywhere yet

All three do the same thing. Standardise on option 3 using `CompositeNavigationProp` from `@react-navigation/native` — it's fully typed and removes all `as any` casts in navigation.

---

## 6. Magic Numbers / Inline Literals

| File | Value | Meaning | Fix |
|---|---|---|---|
| `src/screens/home/CreateScreen.tsx` | `14 * 24 * 60 * 60 * 1000` | Max plan lookahead (14 days in ms) | Export `MAX_PLAN_LOOKAHEAD_DAYS = 14` from `src/utils/plan.ts` |
| `src/screens/onboarding/SignupDobScreen.tsx` | `365.25 * 24 * 60 * 60 * 1000` | Age calculation constant | Extract to `utils/time.ts` |
| `src/screens/home/HomeMapScreen.tsx` | `0.012` (pad degrees) | Map bounding box padding | Name as `MAP_BBOX_PAD_DEG` |
| `src/screens/recaps/StoryViewerScreen.tsx` | `hitSlop={12}`, `hitSlop={10}` | Various hitSlop values | Use `spacing.sm` / `spacing.md` tokens consistently |
| `src/components/molecules/SectionHeader.tsx` | `hitSlop={8}` | Touch target expansion | Use `spacing.sm` |
| `src/screens/recaps/RecapPostScreen.tsx` | `hitSlop={8}` | Touch target expansion | Use `spacing.sm` |

---

## 7. `eslint-disable` Comments for Dynamic `require()`

`src/services/push.ts` has **four** `// eslint-disable-next-line @typescript-eslint/no-var-requires` blocks (lines 39, 64, 122, 124) all for the same pattern: conditionally requiring `expo-notifications` / `expo-device` to avoid a crash when native modules aren't present.

This pattern is correct (it's the only safe way to guard native requires in RN), but all four could be consolidated into a single `requireGuarded()` helper at the top of the file, replacing the repeated pattern with one call site.

---

## 8. `getUserHostedPlans` Always Throws (Known Gap)

`src/api/plans.ts:271` — `getUserHostedPlans` does a direct `supabase.from('plans').select('*')` which fails with `42501` in production due to the `plans_select → users` RLS cascade. The function body has a comment documenting this. `ProfileOtherScreen` calls it and catches the error, showing an empty tab silently.

**Impact:** Other users' "Hosted" tab is permanently empty in production.  
**Fix:** Write `get_user_plans(p_user_id uuid)` SECURITY DEFINER migration (one-line extension of `get_my_plans`).

---

## 9. `hitSlop` Values — Two Patterns in Use

`hitSlop` is set as:
- A token (`hitSlop={spacing.sm}`) — used in ~60% of places
- A raw number (`hitSlop={8}`, `hitSlop={10}`, `hitSlop={12}`) — used in ~40% of places

Standardise on `spacing.sm` (= 8) everywhere. Raw numbers make design-system changes harder.

---

## 10. `react-native-worklets` in Dependencies

`react-native-worklets` (`0.8.3`) is listed in `package.json`. This package is an internal Reanimated dependency that should not need to be declared separately — Reanimated 4.x bundles it. Verify it's actually needed; if not, remove it to avoid version-conflict risk.

---

## Summary Table

| # | Category | Severity | Files Affected |
|---|---|---|---|
| 1 | `as any` / unsafe casts | MEDIUM | 7 |
| 2 | Silent catch handlers | LOW–MEDIUM | 5 |
| 3 | Console logs in prod | LOW | 2 |
| 4 | Duplicate `getMyProfile` calls | MEDIUM | 8 |
| 5 | Inconsistent navigation casting | MEDIUM | 3 |
| 6 | Magic numbers | LOW | 6 |
| 7 | Repeated `eslint-disable` blocks | LOW | 1 |
| 8 | Known broken API function | HIGH | 2 |
| 9 | Inconsistent `hitSlop` values | LOW | ~10 |
| 10 | Possibly redundant dependency | LOW | `package.json` |
