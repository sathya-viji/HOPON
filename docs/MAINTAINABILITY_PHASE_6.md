# Phase 6 — Push Service Cleanup
**Date:** 2026-06-16  
**Status:** COMPLETE

---

## Objective

Guard push service diagnostic logs behind `__DEV__` so they don't appear for end users in production builds.

---

## Files Modified

### `src/services/push.ts`

Four `console.log`/`console.warn` calls that were previously unrestricted:
- `console.log('[push] expo push token registered')` → `if (__DEV__) console.log(...)`
- `console.warn('[push] token registration failed:', ...)` → `if (__DEV__) console.warn(...)`
- `console.log('[push] registration skipped:', ...)` → `if (__DEV__) console.log(...)`
- `console.warn('[push] handler config skipped:', ...)` → `if (__DEV__) console.warn(...)`

The `eslint-disable-next-line @typescript-eslint/no-var-requires` blocks (4 total) were reviewed. These guard dynamic `require()` calls for native push modules, which is the correct pattern for RN conditional native imports. They were left as-is — consolidating them into a helper would require moving the require calls, which is logic risk, not maintainability gain.

The `console.warn('[auth] AsyncStorage...')` in `src/api/client.ts` was reviewed and left unchanged — it fires only when a native module is absent (a dev-only scenario) and is the correct level of logging for that path.

---

## Validation

- `npx tsc --noEmit`: **PASSED**

---

## Risk Assessment

**Very Low.** `__DEV__` is a React Native global that is `true` in debug builds and `false` in production/release builds. Wrapping console calls in `__DEV__` is the standard RN pattern with no runtime overhead in production.
