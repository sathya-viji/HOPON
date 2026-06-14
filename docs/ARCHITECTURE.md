# HopOn — Frontend Architecture

## Overview

HopOn is a React Native application built with Expo SDK 56. The frontend is currently in a pre-backend prototype state: all data is served from a local mock layer, and screens are fully functional UI built against typed domain models. The architecture is designed so that replacing the mock layer with real API calls requires zero changes to screen files or components.

---

## Core Architectural Principle: Screens Own Zero Styles

This is the single most important rule in the codebase.

**Screen files (`src/screens/**`) must not contain:**
- `StyleSheet.create()`
- Inline `style={{ hardcodedValue: 123 }}` objects with literal numeric or color values
- Direct font, color, spacing, or radius values

**Why this rule exists:**

A screen file is a layout declaration, not a style sheet. When screens own their own styles, design-system changes (a token rename, a spacing adjustment, a dark mode fix) require hunting through every screen file individually. With this rule, a change to `spacing.md` in `tokens.ts` propagates everywhere automatically.

**What screens may do instead:**
- Use layout primitives: `<Row>`, `<Stack>`, `<ScreenPad>`, `<SectionBlock>`
- Use typography wrappers: `<T.LabelLg>`, `<T.BodyMd>`, etc.
- Use `colors.*` values from `useTheme()` for dynamic, theme-aware color
- Use token references: `spacing.md`, `radii.sm`, `borderWidths.thin`
- Use `const StyleSheet_absoluteFill = StyleSheet.absoluteFill` for structural layout constants (photo covers, map overlays) — this is the only accepted `StyleSheet.*` usage in a screen

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│  Screens  (src/screens/**)                          │
│  — Layout only. Zero style ownership.               │
│  — Compose primitives, atoms, molecules, organisms  │
└────────────────────┬────────────────────────────────┘
                     │ compose
┌────────────────────▼────────────────────────────────┐
│  Components  (src/components/**)                    │
│  atoms / molecules / organisms                      │
│  — Own their own styles via tokens                  │
│  — Never import from screens                        │
└────────────────────┬────────────────────────────────┘
                     │ consume
┌────────────────────▼────────────────────────────────┐
│  Design System  (src/theme/**)                      │
│  tokens → textStyles → ThemeContext → T.* / layout  │
└─────────────────────────────────────────────────────┘
                     │ types from
┌────────────────────▼────────────────────────────────┐
│  Domain Types  (src/types/**)                       │
│  Pure TypeScript. No React. No RN imports.          │
└─────────────────────────────────────────────────────┘
                     │ data from (temporary)
┌────────────────────▼────────────────────────────────┐
│  Mocks  (src/mocks/**)                              │
│  — Replaces the API/repository layer during dev     │
│  — Same shape as future real data                   │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Expo SDK 56 / React Native 0.85 | Managed workflow |
| Language | TypeScript (strict) | `strict: true` in tsconfig |
| Navigation | React Navigation v7 | Stack + Bottom Tabs |
| Gestures | react-native-gesture-handler | Pressable from RNGH, not RN core |
| Keyboard | react-native-keyboard-controller | Used in `Screen` component |
| Safe area | react-native-safe-area-context | Consumed in `Screen` component |
| Images | expo-image | Preferred over RN Image for caching |
| Animation | react-native-reanimated | For Animated values; simple cases use RN Animated |
| Maps | react-native-maps | Used in HomeMapScreen |

---

## Dependency Direction

Dependencies flow in one direction only:

```
screens → components → theme → tokens
screens → types
screens → hooks
screens → utils
components → theme → tokens
components → types
hooks → utils
hooks → types
```

**Never:**
- A component importing from a screen
- `theme` importing from `components`
- `types` importing from anywhere in `src/`

---

## Key Files for New Engineers

Read these in order to understand the system:

1. `src/theme/tokens.ts` — the primitive values everything is built from
2. `src/theme/textStyles.ts` — how tokens compose into named text styles
3. `src/theme/ThemeContext.tsx` — how the theme is made adaptive
4. `src/components/atoms/T.tsx` — the typography API all screens use
5. `src/components/layout/Row.tsx` and `Stack.tsx` — the two most used layout primitives
6. `src/components/layout/Screen.tsx` — the shell every screen renders inside
7. `src/navigation/types.ts` — the complete navigation surface area
8. `src/types/plan.ts` and `user.ts` — the two core domain models
