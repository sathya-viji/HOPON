# Architecture Audit
**Audit date:** 2026-06-16 · **Scope:** Full codebase — patterns, contracts, layering

---

## 1. Overall Assessment

The architecture is **solid and well-thought-out**. The layering (types → api → state → hooks → components → screens → navigation) is consistently respected. The backend contract (RPC-only mutations, SECURITY DEFINER reads, no direct table mutations from the client) is maintained throughout. The few issues below are refinements, not structural problems.

**Verdict: Production-ready architecture. Issues below are maintainability improvements, not blockers.**

---

## 2. Strengths

### 2.1 Clean API Layer
- All mutations go through named RPCs (`supabase.rpc()`). No direct `INSERT`/`UPDATE`/`DELETE` from the client except `users` column-grant updates (profile edits) — which is the designed exception.
- All reads use SECURITY DEFINER RPCs (`get_home_feed`, `get_plan_detail`, `get_my_plans`, `get_notifications`, etc.) — never raw table selects for privileged data. This is the correct pattern for the RLS cascade issue documented throughout.
- `mappers.ts` cleanly absorbs the snake_case → camelCase translation in one place.

### 2.2 State Architecture
- `AuthContext` (session gate) and `SessionContext` (notification state) are cleanly separated. Auth gate doesn't know about notifications; notification state doesn't gate auth.
- The `suspension.ts` and `pendingStory.ts` mini-stores using `useSyncExternalStore` are elegant — no Redux, no Context re-renders for global boolean flags.
- `ONBOARDED_KEY` in `AuthContext` is a smart offline-boot pattern that avoids a getUser() network call.

### 2.3 Error Handling Contract
- `errors.ts` centralises all known backend error codes into typed constants with user-facing copy. No screen hardcodes a backend error string.
- `account_suspended` side-effect (flipping the suspension banner) is handled centrally in `errorMessage()`, not scattered across screens.

### 2.4 Navigation
- Stack-per-tab approach (`HomeStack`, `ProfileStack`, `RecapsStack`) is standard and correct.
- `types.ts` param-lists are defined centrally.

---

## 3. Architectural Issues

### 3.1 `getMyProfile` Called in 8+ Screens (State Duplication)

**Problem:** The signed-in user's profile (`User`) is loaded independently in SettingsScreen, ProfileScreen, PlanRequestedScreen, RecapPostScreen, RecapsScreen, CreateStoryScreen, and others. Each screen owns local `useState<User | null>(null)` and fires its own network request on focus.

**Impact:**
- Profile can show different data between screens mid-session (e.g. if the user just edited their name).
- 8 network requests fire on a typical session instead of 1.
- Any profile update requires manually refreshing multiple screens.

**Fix:** Add `me: User | null` and `refreshMe: () => void` to `SessionContext`. Load once on login. All screens read `const { me } = useSession()`.

---

### 3.2 Cross-Stack Navigation Uses `as any` Casts

**Problem:** Navigating from `HomeStack` to `RecapsTab → RecapPost`, or from `NotificationsScreen` to screens on other stacks, is done with `(navigation as any).navigate(...)` or `(navigation.getParent() as any)?.navigate(...)`.

**Impact:** TypeScript can't catch incorrect route names or params at compile time. A typo in a route name silently does nothing at runtime.

**Fix:** Use `CompositeNavigationProp` from `@react-navigation/native`. Define a `RootNavigationProp` type in `navigation/types.ts` that composes all tab stacks. Import it in screens that navigate cross-stack.

```ts
// navigation/types.ts
export type RootNavProp = CompositeNavigationProp<
  HomeStackNavProp,
  BottomTabNavigationProp<MainTabParamList>
>;
```

---

### 3.3 `getUserHostedPlans` Bypasses the RPC Rule

**Problem:** `src/api/plans.ts:281` does `supabase.from('plans').select('*')` — a direct table read — which violates the project's own rule (all plan reads through SECURITY DEFINER RPCs). The function has a comment acknowledging it throws in production.

**Impact:** `ProfileOtherScreen`'s "Hosted" tab is permanently empty for real users. A `.catch(() => [])` silently masks the 42501 error.

**Fix:** Write a `get_user_plans(p_user_id uuid)` SECURITY DEFINER migration — it's a one-line adaptation of `get_my_plans`. Until then, the function should throw explicitly with a descriptive error rather than returning an empty array silently.

---

### 3.4 Mock Layer Still Present at Runtime

**Problem:** `src/components/molecules/PlanRow.tsx` and `RecapCard.tsx` import `getUserById` from `@/mocks` as a fallback for when the API hasn't embedded the host/author. This means the mock data file is bundled in production.

**Impact:** Production bundle includes development mock data (6 fake users with fake names, avatar paths, etc.). If a `plan.host` is ever `undefined` in production (a bug), the component silently renders a fake mock user instead of showing an error.

**Fix:** Remove the mock imports. If `plan.host` is undefined, render a neutral placeholder avatar. The API contract guarantees `host` is always embedded for feed items.

---

### 3.5 `SessionContext` Doesn't Expose Profile — Forces Screen-Level Fetches

**Problem:** `SessionContext` manages notifications and push registration but not the signed-in user's profile. This causes the duplication in §3.1 above.

**Broader observation:** With `me` added to `SessionContext`, the context would hold:
- `notifs`, `unreadCount` (notifications)
- `me` (own profile)

This is a natural grouping — it's "what the app knows about the current authenticated user."

---

### 3.6 `NavBar` Component Is Legacy

`src/components/organisms/NavBar.tsx` is the old custom bottom navigation bar from before `AppTabBar.tsx` was introduced. It is still used in `src/screens/_Placeholder.tsx` (which is itself orphaned). `NavBar` should be deleted once `_Placeholder.tsx` is removed.

---

## 4. Dependency Architecture

### Dependencies to Review

| Package | Status |
|---|---|
| `react-native-maps` | **Unused** — `HomeMapScreen` uses a faux-map, not the SDK |
| `react-native-worklets` | **Likely redundant** — Reanimated 4.x bundles it internally |
| `expo-linear-gradient` | Used correctly (story/recap gradients) |
| `expo-contacts` | Used correctly (contacts sync onboarding) |
| `expo-location` | Used correctly (GPS home location) |
| `@gorhom/bottom-sheet` | Used correctly (LocationPickerSheet) |
| `react-native-keyboard-controller` | Used correctly (`Screen.tsx` keyboard-aware scroll) |

### `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` Hardening

The Places API key is embedded in the client bundle (`EXPO_PUBLIC_*` prefix). It is restricted to the Places API (New) in Google Cloud Console but is client-visible. For production scale, proxy via a Supabase Edge Function (`places-proxy`) so the key is server-side only. This was flagged as a post-launch hardening item.

---

## 5. Architecture Recommendations (Priority Order)

| Priority | Action | Effort |
|---|---|---|
| HIGH | Add `me` + `refreshMe` to `SessionContext` | 2h |
| HIGH | Write `get_user_plans` RPC + fix `getUserHostedPlans` | 1h |
| MEDIUM | Remove mock imports from `PlanRow` + `RecapCard` | 30min |
| MEDIUM | Type cross-stack navigation with `CompositeNavigationProp` | 2h |
| LOW | Remove `react-native-maps` from `package.json` | 5min |
| LOW | Delete `NavBar.tsx` + `_Placeholder.tsx` + 3 unused hooks | 10min |
| POST-LAUNCH | Places API key → Edge Function proxy | 3h |
