# Phase 4 — Extract Magic Numbers to Constants
**Date:** 2026-06-16  
**Status:** COMPLETE

---

## Objective

Replace inline magic number literals with named constants, making the intent clear and enabling future changes at a single point.

---

## Files Created

### `src/constants/plan.ts` (new file)

```ts
export const MAX_PLAN_LOOKAHEAD_DAYS = 14;
export const MAX_PLAN_LOOKAHEAD_MS = MAX_PLAN_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
```

These were previously inlined as `14 * 24 * 60 * 60 * 1000` in `CreateScreen.tsx`, with a comment referencing the server cap but no single source of truth.

---

## Files Modified

### `src/screens/home/CreateScreen.tsx`
- Added `import { MAX_PLAN_LOOKAHEAD_MS } from '@/constants/plan'`
- Changed `14 * 24 * 60 * 60 * 1000` → `MAX_PLAN_LOOKAHEAD_MS`

### `src/utils/time.ts`
- Added exported constant `MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000`
- Added comment documenting it as a Julian year value

### `src/screens/onboarding/SignupDobScreen.tsx`
- Added `import { MS_PER_YEAR } from '@/utils/time'`
- Changed `365.25 * 24 * 60 * 60 * 1000` → `MS_PER_YEAR`

### `src/screens/home/HomeMapScreen.tsx`
- Changed `const pad = 0.012` → `const MAP_BBOX_PAD_DEG = 0.012` with a comment explaining the value in real-world terms (~1.3 km)
- Updated all four usages of `pad` to `MAP_BBOX_PAD_DEG`

---

## Validation

- `npx tsc --noEmit`: **PASSED**

---

## Risk Assessment

**Very Low.** All extracted values are identical to the inline literals they replaced. Numeric behavior is unchanged.
