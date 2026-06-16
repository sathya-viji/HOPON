# Phase 2 — Repository Hygiene
**Date:** 2026-06-16  
**Status:** COMPLETE

---

## Objective

Fix committed macOS metadata artifacts, gitignore gaps, and remove unused native package dependency.

---

## Changes Made

### `.DS_Store` Removal

Deleted three macOS metadata files that had no place in the repository:
- `src/.DS_Store`
- `src/screens/.DS_Store`
- `src/components/.DS_Store`

Note: The repository has no git history (not yet initialised as a git repo), so `git rm --cached` was not applicable — files were removed directly.

### `.gitignore` Updates

Added to `.gitignore`:
- `**/.DS_Store` — catches `.DS_Store` files in any subdirectory (the existing `.DS_Store` entry only matched root)
- `_soak/` — test soak artefact directory at repo root
- `_uxaudit/` — UX audit artefact directory at repo root

### `package.json` — Removed `react-native-maps`

Removed `"react-native-maps": "1.27.2"` from dependencies. Confirmed zero imports of `MapView` or anything from `react-native-maps` in all of `src/`. The home map screen (`HomeMapScreen.tsx`) uses a custom SVG/View implementation, not the maps SDK.

**Developer action required after merge:** Run `npx expo install` (or `npm install`) to clean the lock file. When next running `expo run:ios` or `expo run:android`, the native layer will rebuild without the maps SDK, reducing binary size.

`react-native-worklets` (`0.8.3`) was reviewed but **not removed** — it is a peer dependency of `react-native-reanimated` 4.x and its presence is expected. Removing it without a version-compatibility audit could break Reanimated.

---

## Validation

- `npx tsc --noEmit`: **PASSED**
- `package.json`: valid JSON, all remaining dependencies confirmed used in `src/`

---

## Risk Assessment

**Very Low.** No source code changed. `.DS_Store` removal is cosmetic. Removing an unused native package from `package.json` only affects the next install/build.
