# Phase 3 — Type Safety Improvements
**Date:** 2026-06-16  
**Status:** COMPLETE

---

## Objective

Replace `as any` and `style?: any` usages with explicit types, removing unsafe casts that suppress compiler errors.

---

## Files Modified

### `src/components/atoms/FadeUp.tsx`
- Added `import { type StyleProp, type ViewStyle } from 'react-native'`
- Changed `style?: any` → `style?: StyleProp<ViewStyle>`
- Effect: callers now get a type error if they pass a non-view style (e.g. a text style) — compiler catches misuse.

### `src/api/realtime.ts`
- Changed `payload.new as any` → `payload.new as unknown as Parameters<typeof mapMessageRow>[0]`
- This documents that we're casting the raw Realtime payload row to the shape `mapMessageRow` expects, using the function's own parameter type as the target. If `mapMessageRow`'s signature changes, this cast updates automatically.
- Removed use of the local `type Row = Record<string, any>` for this cast (it remains defined in case it's needed for future subscriptions).

### `src/navigation/AppTabBar.tsx`
- Added `import type { NavigationState, PartialState } from '@react-navigation/native'`
- Changed `getDeepestRouteName(state: any)` → typed as `NavigationState | PartialState<NavigationState>`
- Added `type CrossTabNav` alias documenting the cross-tab navigate shape
- Changed three `(navigation as any).navigate(...)` → `(navigation as unknown as CrossTabNav).navigate(...)`

### `src/screens/home/LocSearchScreen.tsx`
- Added `type StackNavWithPopTo` alias documenting that `popTo` is a React Navigation 7 method not yet in the TypeScript definitions
- Changed three `(navigation as any).popTo(...)` → `(nav as StackNavWithPopTo).popTo(...)` where `nav = navigation as unknown as StackNavWithPopTo`

### `src/screens/notifications/NotificationsScreen.tsx`
- Added `type TabNav` alias documenting the cross-stack tab navigate shape
- Changed `(navigation as any).navigate(route, ...)` → explicit cast with inline type
- Changed `(navigation.getParent() as any)?.navigate(...)` → `(navigation.getParent() as unknown as TabNav | undefined)?.navigate(...)`

### `src/screens/plan/PlanEndedScreen.tsx`
- Added `type TabNav` alias (same pattern as NotificationsScreen)
- Changed `(navigation.getParent() as any)?.navigate(...)` → `(navigation.getParent() as unknown as TabNav | undefined)?.navigate(...)`

---

## Design Decision

All navigation casts use the `as unknown as T` pattern (double-cast via `unknown`) rather than a single `as T`. This is the TypeScript-safe way to assert that you are deliberately narrowing to a type that the compiler can't verify — it makes the intent explicit and forces the reader to understand this is a documented intentional cast, not an accidental type mismatch.

The `TabNav` and `CrossTabNav` type aliases serve as inline documentation of *why* the cast exists, visible to future contributors reading the cast site.

---

## Validation

- `npx tsc --noEmit`: **PASSED** (zero errors)

---

## Risk Assessment

**Low.** All changes are type-only — zero runtime behavior change. The same values are passed to the same functions; only the compile-time types differ. All casts produce identical JavaScript output to the previous `as any` forms.
