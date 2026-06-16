# Maintainability Execution Plan
**Created:** 2026-06-16  
**Scope:** `src/` + `docs/` — all TypeScript/TSX files and documentation  
**Constraint:** Zero behavior changes. Preserve all UI, navigation, RPC, and backend contracts.

---

## Audit Sources

Inputs read before this plan was written:

- `DEAD_CODE_REPORT.md` — verified independently (see corrections below)
- `MAINTAINABILITY_AUDIT.md` — verified independently
- `NAMING_CONVENTIONS.md` — verified independently
- `FOLDER_STRUCTURE.md` and `FOLDER_STRUCTURE_PROPOSAL.md`
- `DOCUMENTATION_AUDIT.md`
- `ARCHITECTURE.md` and `ARCHITECTURAL_PRINCIPLES.md`
- Direct inspection of affected source files

---

## Audit Corrections (Independent Verification)

The following findings in the audit documents were verified or corrected:

| Report Finding | Status |
|---|---|
| `NavBar.tsx` described as legacy/unused (DEAD_CODE_REPORT §5 mention) | **INCORRECT** — `NavBar` is imported by `AppTabBar.tsx` and is actively used. Do not delete. |
| `useBackHandler.ts`, `usePlanStatus.ts`, `useTheme.ts` — unused | **CONFIRMED** — zero imports from these files outside themselves. Safe to delete. |
| `_Placeholder.tsx` — not referenced in navigation | **CONFIRMED** — zero navigation imports. Safe to delete. |
| Mock imports in `PlanRow.tsx` and `RecapCard.tsx` | **CONFIRMED** — both import `getUserById` from `@/mocks`. |
| `getUserHostedPlans` broken (42501) | **CONFIRMED** — function has the warning comment; callers catch silently. |
| `.DS_Store` files committed | **CONFIRMED** — three files present in `src/`, `src/screens/`, `src/components/`. |
| `react-native-maps` unused | **CONFIRMED** — no `MapView` or maps import anywhere in `src/`. |
| `StyleSheet_absoluteFill` local rename noted as unnecessary | **CONFIRMED** — but `ARCHITECTURE.md` explicitly documents this pattern as acceptable for structural layouts. **Do not remove** — it documents intent per architectural conventions. |

---

## Phase Overview

| Phase | Work | Risk | Effort |
|---|---|---|---|
| **Phase 1** | Dead code removal (hooks, screen, mocks) | Very Low | ~30 min |
| **Phase 2** | Repository hygiene (.DS_Store, .gitignore, package.json) | Very Low | ~15 min |
| **Phase 3** | Type safety improvements (as any → proper types, FadeUp style prop) | Low | ~45 min |
| **Phase 4** | Magic numbers → named constants | Low | ~20 min |
| **Phase 5** | hitSlop standardisation | Very Low | ~10 min |
| **Phase 6** | push.ts cleanup (console.log → __DEV__ guards, eslint consolidation) | Very Low | ~15 min |
| **Phase 7** | Documentation update (TESTING.md, FOLDER_STRUCTURE.md, EndorseScreen comment) | Low | ~1h |

**Not in plan (deferred):**

- `getUserHostedPlans` fix — requires a new migration + RPC. Behavior change, out of scope.
- Moving `screens/home/` subdirectories — import churn with low benefit.
- Lifting `myProfile` into `SessionContext` — architecture change, behavior risk.
- `CompositeNavigationProp` full migration — medium-risk, already partially addressed in Phase 3.
- Removing `react-native-worklets` — needs verification that Reanimated 4 does or does not bundle it; defer to native dependency audit.
- `mocks/` Metro blockList exclusion — build system change, out of scope.

---

## Phase 1 — Dead Code Removal

**Objective:** Remove confirmed unused files and production mock imports.

### 1a. Delete unused hook files

Files to delete:
- `src/hooks/useBackHandler.ts` — zero imports
- `src/hooks/usePlanStatus.ts` — zero imports
- `src/hooks/useTheme.ts` — zero imports (all callers use `@/theme` directly)

### 1b. Delete orphaned placeholder screen

File to delete:
- `src/screens/_Placeholder.tsx` — not imported in any navigator or screen

### 1c. Remove mock imports from production components

**`src/components/molecules/PlanRow.tsx`:**
- Remove `import { getUserById } from '@/mocks'`
- Change `const host = plan.host ?? getUserById(plan.hostId)` → `const host = plan.host`
- If `host` can be null in the type, add appropriate null guard (render nothing or skeleton)

**`src/components/molecules/RecapCard.tsx`:**
- Remove `import { getUserById } from '@/mocks'`
- Change `const author = recap.author ?? getUserById(recap.authorId)` → `const author = recap.author`
- Same null guard as above

**Why Phase 1 first:** Lowest risk, highest signal/noise ratio. Removing dead code before anything else ensures later type-checking runs clean.

**Validation:** TypeScript compile (`npx tsc --noEmit`). No tests depend on these files.

---

## Phase 2 — Repository Hygiene

**Objective:** Fix committed artifacts, gitignore gaps, and unused package dependencies.

### 2a. Remove committed .DS_Store files

```bash
git rm --cached src/.DS_Store src/screens/.DS_Store src/components/.DS_Store
```

### 2b. Update .gitignore

Current `.gitignore` has `.DS_Store` at root level only. Add:
```
**/.DS_Store
_soak/
_uxaudit/
```

### 2c. Remove unused `react-native-maps` dependency

Remove `"react-native-maps": "1.27.2"` from `package.json`. No source file imports it.

**Note:** Do NOT run `npm install` or rebuild — the lock file change and binary removal is sufficient for maintainability. Flag to the developer to run `npx expo install` after merge to clean the native layers.

**Why Phase 2 second:** No source changes — pure repo hygiene. Can't break anything.

**Validation:** Verify `git status` is clean after `git rm`. Verify `package.json` parse is valid.

---

## Phase 3 — Type Safety Improvements

**Objective:** Replace `as any` and weak types with proper TypeScript types where the fix is low-risk and mechanical.

### 3a. `src/components/atoms/FadeUp.tsx` — `style?: any`

Change to `style?: StyleProp<ViewStyle>` from `react-native`. Purely additive narrowing.

### 3b. `src/api/realtime.ts` — `payload.new as any`

Cast `payload.new` as the known `MessageRow` type (already used elsewhere in the file). Replace `payload.new as any` with `payload.new as MessageRow`.

### 3c. `src/navigation/AppTabBar.tsx` — `state: any` and three navigation casts

- Type `state` parameter as `NavigationState | PartialState<NavigationState>` from `@react-navigation/native`
- The three `(navigation as any).navigate(...)` calls: these navigate within a tab navigator using the navigator's own `navigate`. Use `useNavigation` with `BottomTabNavigationProp` or keep the cast but narrow it to a typed interface. Given the cross-tab complexity, narrow to the minimum safe change: type the function parameter, leave navigation casts as `as NavigationContainerRef<RootParamList>` (explicit, not `as any`).

### 3d. `src/screens/home/LocSearchScreen.tsx` — three `popTo` casts

RN7's `popTo` is not in React Navigation's TypeScript definitions yet. Add a module augmentation or a typed wrapper. Safest fix: keep cast but change `as any` → cast to the specific stack navigator prop type.

### 3e. `src/screens/notifications/NotificationsScreen.tsx` and `src/screens/plan/PlanEndedScreen.tsx`

Cross-stack navigation casts. Change `(navigation as any)` → `(navigation as unknown as RootTabNavigation)` using a local type alias for the cross-stack navigation shape. This is safer than `as any` and documents intent.

**Why Phase 3 third:** After dead code removal, the type surface is smaller. These changes improve compiler coverage without any logic changes.

**Validation:** TypeScript compile must pass after each change.

---

## Phase 4 — Extract Magic Numbers to Constants

**Objective:** Create `src/constants/plan.ts` and move inline literals there.

Constants to extract:
- `CreateScreen.tsx`: `14 * 24 * 60 * 60 * 1000` → `MAX_PLAN_LOOKAHEAD_MS` (with `MAX_PLAN_LOOKAHEAD_DAYS = 14`)
- `SignupDobScreen.tsx`: `365.25 * 24 * 60 * 60 * 1000` → extract to `src/utils/time.ts` as `MS_PER_YEAR`
- `HomeMapScreen.tsx`: `0.012` → `MAP_BBOX_PAD_DEG` (local constant in file, not global — map-specific)

**Why Phase 4 fourth:** Lower risk than type changes. Pure constant extraction.

**Validation:** TypeScript compile. Screen behavior unchanged.

---

## Phase 5 — hitSlop Standardisation

**Objective:** Replace hardcoded `hitSlop` numbers with design tokens.

Files to change:
- `src/components/molecules/SectionHeader.tsx`: `hitSlop={8}` → `hitSlop={spacing.sm}`
- `src/screens/recaps/RecapPostScreen.tsx`: `hitSlop={8}` → `hitSlop={spacing.sm}`
- `src/screens/recaps/StoryViewerScreen.tsx`: `hitSlop={12}` → `hitSlop={spacing.md}`, `hitSlop={10}` → `hitSlop={spacing.sm}` (10 rounds to sm=8; check if md=12 is better intent)

**Why Phase 5 fifth:** Trivial. No logic change.

**Validation:** TypeScript compile.

---

## Phase 6 — Push Service Cleanup

**Objective:** Wrap console.log/warn in `__DEV__` guard; consolidate eslint-disable pattern in push.ts.

Changes in `src/services/push.ts`:
1. Wrap `console.log('[push]...')` and `console.warn('[push]...')` calls in `if (__DEV__) { ... }` 
2. The four `eslint-disable-next-line` blocks cannot be consolidated into one without restructuring the require() call sites — keep them per-line but add a short comment explaining why they're needed (native guard pattern). Do not restructure the require logic itself (behavior risk).

**Why Phase 6 sixth:** Small, isolated file. Zero logic change.

**Validation:** TypeScript compile.

---

## Phase 7 — Documentation Updates

**Objective:** Fill documented gaps in `docs/` directory.

### 7a. Write `docs/TESTING.md`

Cover:
- How to run pgTAP tests locally (`supabase test db` + reset caveat)
- What the tests cover (suite breakdown, count)
- How to add a new test
- The multi-user validation harness at `scripts/validate_multiuser.mjs`

### 7b. Update `docs/FOLDER_STRUCTURE.md`

Add note that `FOLDER_STRUCTURE_PROPOSAL.md` supersedes it for the proposed target state. Update to reflect current reality: `api/hooks/` exists, `services/` exists, `state/` exists (was called `contexts/` in older docs).

### 7c. Add comment to `src/screens/plan/EndorseScreen.tsx`

One-line comment explaining host vs peer endorsement mode branching (identified in DOCUMENTATION_AUDIT.md).

### 7d. Archive `DOCUMENTATION_REPORT.md`

The prior doc audit report is superseded by the new audit docs. Add a header to it pointing to the current docs.

**Why Phase 7 last:** Documentation changes carry zero code risk. Save for last so earlier phases don't invalidate what's written.

**Validation:** Manual review for accuracy.

---

## Deferred / Out-of-Scope Items

These are documented but NOT implemented in this sprint:

| Item | Reason Deferred |
|---|---|
| `getUserHostedPlans` — fix or remove | Requires new migration (`get_user_plans` RPC). Backend behavior change. |
| Lift `myProfile` into `SessionContext` | Architecture change; refactors 8 screens. High regression risk. |
| Full `CompositeNavigationProp` migration | Medium effort; requires nav type audit across all stacks. |
| Move `screens/home/create/` and `screens/home/search/` | Import churn; nav route names stay same but many files change. |
| `react-native-worklets` removal | Needs Reanimated version verification first. |
| `mocks/` Metro blockList exclusion | Build system change; needs testing on both platforms. |
| `SettingsScreen` silent catch → console.warn | Logic is fine; adding logging is a DX improvement only, low priority. |
| `react-native-maps` native layer cleanup | Removing from package.json is done in Phase 2; native unlink requires `expo run:ios` rebuild (developer action). |
