# Navigation Architecture

## Structure

HopOn uses a two-level navigation hierarchy:

```
RootNavigator (Stack)
├── Onboarding (Stack)          — linear signup / login flow
└── Main (Bottom Tabs)
    ├── HomeTab (Stack)         — feed, plan creation, plan detail, chat
    ├── RecapsTab (Stack)       — recap feed, story creation/viewer
    └── ProfileTab (Stack)      — profile, settings, follows
```

All navigators use `headerShown: false` — headers are rendered inside screen files as composable JSX passed to the `Screen` component's `header` prop, not by the navigator.

---

## Navigator Files

| File | Role |
|---|---|
| `RootNavigator.tsx` | `NavigationContainer` root; applies theme fonts and colors; sets initial route |
| `OnboardingNavigator.tsx` | Linear stack for the signup/login funnel |
| `MainNavigator.tsx` | Bottom tab container — wires `AppTabBar` as the custom tab bar |
| `HomeStack.tsx` | The largest stack; owns plan lifecycle screens, chat, and all cross-tab profile access from home |
| `RecapsStack.tsx` | Recap and story screens |
| `ProfileStack.tsx` | Profile screens and all settings screens |
| `AppTabBar.tsx` | Custom tab bar rendering — uses `NavBar` organism |

---

## Param Types (`src/navigation/types.ts`)

Every route and its params are typed in a single file. This is the navigation contract — the source of truth for what screens exist and what data they require.

**Key patterns:**

```ts
// No params
Home: undefined;

// Required param
Plan: { planId: string };

// Optional param — screen must handle undefined
Create: { location?: string } | undefined;
```

Always update `types.ts` before adding a new screen to a stack. TypeScript will catch any mismatch between the param list and the screen's `route.params` usage.

---

## Navigating Across Tabs

Some screens appear in multiple stacks (e.g. `ProfileOther` is in both `HomeStack` and `RecapsStack`). This is intentional — cross-tab navigation in React Navigation requires the screen to exist in the current stack, not the other tab's stack.

**Pattern for profile access from any tab:**

`ProfileOther` is registered in `HomeStack`, `RecapsStack`, and `ProfileStack`. A user tapping on an avatar in the Recaps tab navigates to `ProfileOther` within the `RecapsStack` — it does not switch tabs.

**Pattern for reset navigation (onboarding → main):**

The onboarding funnel exits via `CommonActions.reset`, not a regular `navigate`. This clears the onboarding stack from history so the back gesture cannot return to it:

```ts
navigation.getParent()?.dispatch(
  CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
);
```

---

## Development vs. Production Initial Route

```ts
initialRouteName={__DEV__ ? 'Main' : 'Onboarding'}
```

In development, the app starts directly in `Main` to skip the login flow during iteration. Before shipping, this should be changed to always start at `Onboarding` and be driven by an auth state check.

---

## `navigationRef`

`RootNavigator` exports a `navigationRef` created with `createNavigationContainerRef`. This ref is available for programmatic navigation from outside the component tree (e.g. from a future notification handler or deep link handler).
