# Architectural Principles and Decisions

This document captures the architectural decisions made during the frontend build phase, with reasoning. It is intended to explain *why* the codebase is shaped the way it is, so future contributors can make consistent decisions in new territory.

---

## Decision 1: Screens own zero styles

**Decision:** Screen files contain no `StyleSheet.create()`, no hardcoded style values, and no direct font/color/spacing literals.

**Reasoning:** The design system was built during the prototype phase and is likely to evolve during product iteration. If screens own their styles, every design-system change requires hunting through 40+ screen files. By routing all visual decisions through layout primitives (`Row`, `Stack`, `ScreenPad`) and the typography API (`T.*`), design-system changes propagate automatically.

**Trade-off accepted:** Screens that need one-off visual adjustments (a slightly different padding, an edge-case color) must express this through token arithmetic (`spacing.md + 4`) rather than arbitrary literals. This is mildly less flexible but far more maintainable.

**Exception:** Full-screen media screens (story viewer, story creator, map) use `StyleSheet.absoluteFill` for structural photo/map backgrounds, and `rgba(...)` overlays for media chrome. These are not design-system concerns — they are media player chrome that is intentionally fixed regardless of theme.

---

## Decision 2: Two-layer typography system (textStyles + T.*)

**Decision:** Text styles are defined in `textStyles.ts` as plain objects, then wrapped in React components in `T.tsx`. This is two layers rather than one.

**Reasoning:** `textStyles.ts` is framework-agnostic. Input components and legacy atoms that use `StyleSheet.create` internally can import raw style objects without importing React components. `T.tsx` is the public API for screens; `textStyles.ts` is the implementation. Separating them means the style values can be tested and reused independently of the React component tree.

---

## Decision 3: ThemeContext resolves mode-conditional colors, not components

**Decision:** Components never contain `useColorScheme()` or `Platform.OS` checks for styling. All adaptive color logic lives in `ThemeContext.tsx`.

**Reasoning:** If every component resolved its own dark mode, dark mode bugs would be scattered across dozens of files. By centralising adaptive color resolution in `ThemeContext`, dark mode correctness is a property of the theme object, not of individual components. Testing dark mode means testing the theme mapping, not auditing every component.

---

## Decision 4: Navigation params are typed in a single file

**Decision:** All param lists live in `src/navigation/types.ts`, not co-located with their navigator files.

**Reasoning:** Cross-stack navigation (e.g. navigating to `ProfileOther` from three different stacks) requires importing param types in multiple places. A single source of truth prevents type drift between stacks. It also makes the full navigation surface area visible in one place — useful for reviewing what screens exist and what data they require.

---

## Decision 5: Mock layer matches the shape of the future API

**Decision:** Mock data in `src/mocks/` is typed using the same domain types in `src/types/` that will be used with real API responses.

**Reasoning:** If mocks use approximate or simplified data shapes, screens develop implicit dependencies on those approximations. When real data arrives with slightly different structure, many screens break simultaneously. By requiring mocks to satisfy the same type contract, the transition to real data is a swap at the data layer, not a refactor of the screen layer.

---

## Decision 6: Cross-tab screens are registered in each stack separately

**Decision:** Screens like `ProfileOther`, `FollowList`, and `FamiliarFaces` appear in multiple stack registrations (HomeStack, RecapsStack, ProfileStack) rather than being accessible via tab-switching.

**Reasoning:** React Navigation's cross-tab navigation requires dispatching a nested tab action and then navigating within that tab's stack. This is complex, fragile, and produces an unexpected UX (the tab bar switches). Registering the screen in each stack that needs it produces clean push navigation without tab switching, at the cost of some duplication in the navigator files.

---

## Decision 7: `Pressable` from react-native-gesture-handler

**Decision:** All `Pressable` usages import from `react-native-gesture-handler`, not from `react-native`.

**Reasoning:** React Native's `Pressable` component can conflict with the gesture system used by `ScrollView` and other gesture containers. RNGH's `Pressable` is gesture-system-aware and resolves correctly inside all container types. This is a one-time convention decision that prevents a class of subtle interaction bugs.

---

## Decision 8: No component-level navigation

**Decision:** Reusable components do not call `useNavigation()` or navigate internally. Navigation is a screen concern.

**Reasoning:** A component that navigates is implicitly coupled to the navigation stack it's used in. `PlanRow` appears in `HomeStack` and `ProfileStack` — if it navigated internally, it would need to know which stack it's in. Passing `onPress` from the screen keeps components stack-agnostic and genuinely reusable.

---

## What Was Not Decided Yet

The following architectural questions are open and will be resolved during backend integration:

- **State management** — whether screens fetch data via hooks, a context, a state manager (Zustand, Redux), or a query library (React Query, SWR)
- **Authentication flow** — how the auth state drives the initial route in `RootNavigator`
- **Error handling** — loading states, error boundaries, retry patterns
- **Caching strategy** — how fetched data is cached and invalidated
- **Real-time updates** — whether plan joiners and chat messages use WebSockets or polling
- **Analytics** — what events are tracked and how

These are intentionally excluded from this documentation because documenting them now would produce documentation that immediately becomes obsolete.
