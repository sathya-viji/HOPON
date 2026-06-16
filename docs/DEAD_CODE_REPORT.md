# Dead Code Report
**Audit date:** 2026-06-16 · **Scope:** `src/` — all TypeScript/TSX files

---

## 1. Unused Hooks (never imported outside their own file)

| File | Symbol | Verdict |
|---|---|---|
| `src/hooks/usePlanStatus.ts` | `usePlanStatus` | Defined, documented, **never imported** anywhere in the codebase. The urgency logic it encodes is re-derived inline in `src/utils/plan.ts → deriveUrgency`. **Delete the file.** |
| `src/hooks/useBackHandler.ts` | `useBackHandler` | Defined, **never imported** anywhere. Android-only BackHandler wrapper with zero callers. **Delete the file.** |
| `src/hooks/useTheme.ts` | re-export of `useTheme` | Is a one-liner re-export (`export { useTheme } from '@/theme/ThemeContext'`). All callers import from `@/theme` directly, never from `@/hooks/useTheme`. **Delete the file.** |

---

## 2. Orphaned / Placeholder Screen

| File | Issue |
|---|---|
| `src/screens/_Placeholder.tsx` | The `Placeholder` component still uses the old `NavBar` / `NavTab` API (custom bottom-bar removed in Wave 1). It is imported **nowhere** in the navigation or any screen. **Delete the file.** |

---

## 3. Mock Data Still Leaking into Production Components

| File | Line | Import | Issue |
|---|---|---|---|
| `src/components/molecules/PlanRow.tsx` | 14, 31 | `getUserById` from `@/mocks` | Used as fallback when `plan.host` is null. In production the API always embeds `host`; this is dead except for local mock runs. **Replace the fallback with `undefined` / handle gracefully without the mock import.** |
| `src/components/molecules/RecapCard.tsx` | 11, 27 | `getUserById` from `@/mocks` | Same pattern — `recap.author ?? getUserById(recap.authorId)`. The real API always populates `recap.author`. **Remove the mock import and simplify to `recap.author`.** |

---

## 4. Known Broken API Function (documented, should be flagged)

| File | Lines | Symbol | Issue |
|---|---|---|---|
| `src/api/plans.ts` | 271–293 | `getUserHostedPlans` | Has a large block comment warning it **always throws** in production (42501 permission error — needs a `get_user_plans` RPC that doesn't exist yet). It is called in `ProfileOtherScreen.tsx:79` with `.catch(() => [])` silently discarding the error. Either create the RPC or remove the function and show an empty state explicitly. |

---

## 5. `.DS_Store` Files Committed to Repo

Three macOS metadata files were committed and should be removed:

```
src/.DS_Store
src/screens/.DS_Store
src/components/.DS_Store
```

Add `**/.DS_Store` to `.gitignore` (currently only `.DS_Store` at root level is ignored). Then:

```bash
git rm -r --cached src/.DS_Store src/screens/.DS_Store src/components/.DS_Store
```

---

## 6. `react-native-maps` in `package.json` — Unused

`react-native-maps` is listed as a dependency (`"react-native-maps": "1.27.2"`) but **`MapView` or any import from `react-native-maps` appears nowhere in the source**. The map screen (`HomeMapScreen.tsx`) uses a custom SVG/View faux-map, not the SDK.

**Action:** Remove from `package.json` unless a real map SDK is planned soon — unused native dependencies add binary size and slow builds.

---

## 7. Unused `_soak/` and `_uxaudit/` Directories

These test artefact directories at the repo root are untracked but should be explicitly gitignored to prevent accidental commits.

Add to `.gitignore`:
```
_soak/
_uxaudit/
```

---

## Summary

| Category | Count | Action |
|---|---|---|
| Unused hooks | 3 | Delete files |
| Orphaned screen | 1 | Delete file |
| Mock imports in production components | 2 | Remove imports |
| Broken API function | 1 | Fix or remove |
| Committed `.DS_Store` files | 3 | `git rm --cached` + gitignore |
| Unused package dependency | 1 | Remove from `package.json` |
| Untracked test artefact dirs | 2 | Add to `.gitignore` |
