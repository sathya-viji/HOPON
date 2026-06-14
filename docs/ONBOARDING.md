# New Engineer Onboarding Guide

Welcome to HopOn. This guide gets you from zero to productive as quickly as possible.

---

## What HopOn is

HopOn is a neighbourhood social planning app. Users post plans (a run, a coffee, a badminton game), others join them. The core loop: discover → join → show up → endorse.

The frontend is a fully functional prototype built against a static mock layer. The architecture is designed so that wiring in a real backend requires no changes to screen files or components — only the mock data sources get replaced.

---

## Prerequisites

- Node 18+
- Xcode (for iOS Simulator)
- Expo CLI: `npm install -g expo-cli`
- An understanding of React Native fundamentals

---

## Getting Started

```bash
cd hopon
npm install
npx expo start          # starts Metro bundler
# press i for iOS Simulator
```

For a native build (required after adding native modules):
```bash
npx expo run:ios
```

---

## Mental Model: Read These Files First

Read in this order — each file builds on the previous one.

1. **`src/theme/tokens.ts`** — Every number and color in the app comes from here. Understand the structure before touching any component.

2. **`src/theme/textStyles.ts`** — How token values compose into named text presets.

3. **`src/components/atoms/T.tsx`** — The typography API. Every string rendered in a screen goes through one of these components.

4. **`src/components/layout/Screen.tsx`** — The shell every screen lives inside. Understand the `header`, `footer`, `scroll`, and `keyboardAware` props.

5. **`src/components/layout/Row.tsx` and `Stack.tsx`** — The two most used layout primitives. They replace raw `View` with explicit layout intent.

6. **`src/navigation/types.ts`** — The complete list of screens and their params. The navigation surface area.

7. **`src/types/plan.ts` and `user.ts`** — The two core domain models. Everything else in the app flows from these.

---

## The Most Important Rule

**Screen files own zero styles.**

If you open any file in `src/screens/` and you see `StyleSheet.create(...)` or an inline `style={{ fontSize: 14 }}`, that is a bug in the codebase, not a pattern to follow.

Screens compose layout primitives (`Row`, `Stack`, `ScreenPad`) and typography wrappers (`T.LabelLg`, `T.BodyMd`) rather than styling themselves. See [Architecture Overview](ARCHITECTURE.md) for why.

---

## Key Concepts

### Plan lifecycle states

A plan has many states, each with its own screen:
- `PlanScreen` — standard viewer (open to join)
- `PlanHostScreen` — host's management view
- `PlanJoinedScreen` — confirmed joiner view
- `PlanRequestedScreen` — pending approval view (closed plans)
- `PlanApprovedScreen` / `PlanDeclinedScreen` — post-request outcomes
- `PlanPostedScreen` — host's confirmation after creating
- `PlanEndedScreen` — post-event wrap-up
- `PlanExpiredScreen` — plan that passed without enough joiners

### Cost types

Plans have one of four cost types: `free`, `copay`, `sponsored`, `seeking`. Each has its own colour group in `colors.cost.*`. The `CostTag` atom renders the appropriate badge.

### Familiar Faces

Users who have attended previous plans together become "familiar faces". This is a trust signal surface throughout the app (plan detail, profiles, endorsements).

### Recaps

After a plan ends, attendees can post photo recaps. Recaps are separate from plans but linked to them. Stories are 24-hour recaps visible in the Recaps tab.

---

## Adding a New Screen

1. Create the file in the appropriate `src/screens/<domain>/` folder
2. Add the route and its params to `src/navigation/types.ts`
3. Register the screen in the appropriate stack navigator
4. Use `<Screen>` as the root component
5. Build layout with `Row`, `Stack`, `ScreenPad` — no raw `View` with style
6. Render all text through `T.*` components
7. Run `npx tsc --noEmit` to confirm zero type errors

---

## Running TypeScript Check

```bash
npx tsc --noEmit
```

No output = zero errors. This should pass clean at all times. Never commit with TypeScript errors.

---

## Where Things Are Not Yet Wired

- **Authentication** — `RootNavigator` starts at `Main` in `__DEV__` mode, bypassing the onboarding flow
- **Real data** — all data comes from `src/mocks/`
- **API calls** — none exist yet; the mock layer is the data source
- **Push notifications** — notification UI exists but no real push infrastructure
- **Analytics** — not yet implemented

These areas are intentionally undocumented in this guide because they will change significantly during backend integration.
