# Naming Conventions
**Audit date:** 2026-06-16 · **Status:** Current conventions + inconsistencies found

This document records the naming conventions the codebase already follows and flags the inconsistencies that should be cleaned up.

---

## 1. Established Conventions (Followed Consistently)

### Files & Folders
| Pattern | Convention | Examples |
|---|---|---|
| Screen files | `PascalCase` + `Screen.tsx` suffix | `HomeScreen.tsx`, `PlanHostScreen.tsx` |
| Component files | `PascalCase.tsx` | `PlanRow.tsx`, `TrustGrid.tsx` |
| Hook files | `camelCase` starting with `use` | `useHomeFeed.ts`, `useHomeLocation.ts` |
| API files | `camelCase` noun | `plans.ts`, `notifications.ts`, `users.ts` |
| Utility files | `camelCase` noun | `plan.ts`, `time.ts`, `avatar.ts` |
| Type files | `camelCase` noun | `plan.ts`, `user.ts`, `notification.ts` |
| State files | `PascalCase` for context files, `camelCase` for stores | `AuthContext.tsx`, `suspension.ts` |

### TypeScript
| Pattern | Convention | Examples |
|---|---|---|
| Interfaces | `PascalCase` | `HomeFeedParams`, `CompleteSignupInput` |
| Type aliases | `PascalCase` | `AuthStatus`, `PlanUrgencyState` |
| Enums/union types | `PascalCase` | `NotifType`, `MemberStatus` |
| Constants | `SCREAMING_SNAKE_CASE` | `CATEGORIES`, `BETA_AUTH`, `DIAL_CODE` |
| Functions | `camelCase` verb phrase | `getHomeFeed`, `joinPlan`, `mapFeedItemToPlan` |
| React components | `PascalCase` | `PlanRow`, `TrustGrid`, `ScreenHeader` |
| React hooks | `camelCase` starting with `use` | `useHomeFeed`, `usePlanDetail` |

### Backend ↔ Frontend Mapping
| Backend (snake_case) | Frontend (camelCase) |
|---|---|
| `plans_attended` | `plansAttended` |
| `starts_at` | `startsAt` |
| `host_id` | `hostId` |
| `avatar_path` | `avatarPath` |
| `location_label` | `location` (shortened in view-model) |

---

## 2. Inconsistencies Found

### 2.1 UK vs US Spelling: `neighbourhood` (British English)

The domain uses British spelling consistently:
- DB column: `neighbourhood`
- Screen: `NeighbourhoodScreen.tsx`
- Settings screen: `SettingsNeighbourhoodScreen.tsx`
- User type: `neighbourhood: string`

**This is intentional and consistent — keep British spelling.** It was an early product decision to match the Indian English standard. No change needed, but new contributors should be aware.

### 2.2 `recap` vs `Recap` — Inconsistent Label Capitalisation in UI Strings

In UI labels (not code), "Recap" appears both capitalised and lowercase across screens:
- `RecapsScreen.tsx`: section label `"NEAR YOU"`, tab label `"Recaps"` (capitalised)
- `AppTabBar.tsx`: tab item `"Recaps"` (capitalised)
- `NotifRow.tsx`: button label `"Post recap"` (lowercase)

**Convention:** In running text / button labels use lowercase (`"post recap"`). In tab bars / section headers use Title Case (`"Recaps"`) or ALL CAPS (`"RECAPS"`). Current usage is mostly consistent with this — `"Post recap"` is correct.

### 2.3 `SectionLabel` vs `SectionHeader` vs `CapsSm`

Three patterns exist for rendering a section label header in screens:

1. `<SectionHeader label="ATTENDEES" count={n} />` — the proper molecule
2. `<T.CapsSm>DEVELOPER</T.CapsSm>` — raw typography atom (SettingsScreen)
3. Inline `Text` with manual `fontFamily: extrabold` styling (legacy/one-offs)

**Convention:** Always use `<SectionHeader>` for list section headers. Use `<T.CapsSm>` only for non-list label text (form field labels, contextual labels).

### 2.4 Props Naming — `onPress` vs `onBack` vs `onClose`

Different components name the "go back / dismiss" callback differently:
- `ScreenHeader`: `onBack?: () => void`
- `LocationPickerSheet`: `onClose: () => void`
- `Button variant="back"`: `onPress: () => void`

**Convention:** Use `onBack` for navigation back actions, `onClose` for modal/sheet dismiss actions. Current usage is mostly correct but worth documenting for new components.

### 2.5 `Placeholder` in `_Placeholder.tsx` — Underscore Prefix

The `_Placeholder.tsx` file uses an underscore prefix to signal "development only". This is a non-standard convention for React Native projects. Since the file should be deleted (see `DEAD_CODE_REPORT.md`), no action needed — but future dev-only utilities should use a `__dev__/` directory instead of underscore prefixes.

### 2.6 Inconsistent `hitSlop` Values

`hitSlop` is specified as:
- `hitSlop={spacing.sm}` — using the design token (preferred)
- `hitSlop={8}` — hardcoded (in `SectionHeader.tsx`, `RecapPostScreen.tsx`, `RecapsScreen.tsx`)
- `hitSlop={10}` — hardcoded (in `StoryViewerScreen.tsx`)
- `hitSlop={12}` — hardcoded (in `StoryViewerScreen.tsx`)

**Convention:** Always use `spacing.sm` (= 8) for standard touch targets. Use `spacing.md` (= 12) for larger targets. Never hardcode `hitSlop` numbers.

---

## 3. Navigation Route Names

Route names are consistently `PascalCase` strings matching the screen name without the `Screen` suffix:

```
HomeScreen → 'Home'
PlanScreen → 'Plan'
PlanHostScreen → 'PlanHost'
NotificationsScreen → 'Notifications'
```

This is consistent throughout `navigation/types.ts` and all stack navigators. ✅

---

## 4. API Function Naming

| Pattern | Convention | Examples |
|---|---|---|
| Read (single) | `get<Entity>` | `getMyProfile`, `getPlanDetail` |
| Read (list) | `get<Entities>` | `getNotifications`, `getMyPlans` |
| Mutate (create) | `create<Entity>` / verb | `createPlan`, `joinPlan` |
| Mutate (update) | `update<Entity>` | `updatePlan`, `updateMyProfile` |
| Mutate (delete) | `cancel` / `delete` / `leave` | `cancelPlan`, `leavePlan`, `deleteAccount` |
| Search | `search<Entities>` | `searchPlans`, `searchUsers` |

This is consistent throughout `src/api/`. ✅

---

## 5. Component Layer Naming

| Layer | Convention | Location |
|---|---|---|
| Atoms | Single-responsibility primitives | `src/components/atoms/` |
| Molecules | Composed of atoms, domain-aware | `src/components/molecules/` |
| Organisms | Complex, context-aware | `src/components/organisms/` |
| Layout | Structural layout primitives | `src/components/layout/` |

This Atomic Design naming is consistent. The one exception: `NavBar.tsx` is in `organisms/` but is no longer used (see `DEAD_CODE_REPORT.md`).
