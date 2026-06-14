# Development Conventions

## Styling Rules

### Rule 1: Screens own zero styles

Screen files contain no `StyleSheet.create()` and no inline style objects with hardcoded values. See [Architecture Overview](ARCHITECTURE.md) for the full rationale.

The only accepted exceptions:
- `const StyleSheet_absoluteFill = StyleSheet.absoluteFill` — for full-screen photo/map covers. This assigns a structural constant, not a style definition.
- `rgba(...)` color strings in full-screen media chrome (story viewer, story creator) — these are intentionally fixed overlay values, not semantic design-system colors.

### Rule 2: Every color goes through the theme

```tsx
// Correct — adaptive to light/dark
const { colors } = useTheme();
<View style={{ backgroundColor: colors.surface }}>

// Correct — fixed brand color
<View style={{ backgroundColor: colorTokens.coral }}>

// Wrong — raw hex in a component that should adapt
<View style={{ backgroundColor: '#F5F5F5' }}>
```

### Rule 3: Every text goes through T.*

```tsx
// Correct
<T.LabelLg>Plan title</T.LabelLg>

// Wrong
<Text style={{ fontFamily: 'Inter-Bold', fontSize: 14 }}>Plan title</Text>
```

The only exception is emoji characters rendered in isolation — use `<Text>` from react-native directly in that case, as emoji rendering is a data concern, not a typography concern.

### Rule 4: Every spacing value uses a token

```tsx
// Correct
paddingHorizontal: spacing.screenPx
gap: spacing.md

// Wrong
paddingHorizontal: 20
gap: 12
```

---

## TypeScript

- Strict mode is on. All types must be explicit — no `any`, no suppressed errors.
- Domain types live in `src/types/`. Component prop types are defined in the same file as the component.
- Navigation param types live in `src/navigation/types.ts`. Always update this file before adding a screen.
- Use `const` assertions (`as const`) on token objects to preserve literal types.

---

## Component Conventions

### Prop naming

- `onPress` for tap handlers (not `onClick`, not `handlePress`)
- `style` for layout style overrides (not for visual overrides — add a named variant prop instead)
- `size`, `variant`, `shape` for named variations

### Children vs. render props

Prefer `children` for content composition. Avoid render props unless the use case genuinely requires passing render-time data back to the caller.

### Default prop values

Define defaults in the function signature destructuring, not with `defaultProps` (which is deprecated for function components).

---

## File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `PlanRow.tsx` |
| Screens | PascalCase + Screen suffix | `PlanScreen.tsx` |
| Hooks | camelCase + use prefix | `useCountdown.ts` |
| Utils | camelCase, noun-first | `time.ts`, `plan.ts` |
| Types | camelCase | `plan.ts`, `user.ts` |
| Navigators | PascalCase + Navigator/Stack | `HomeStack.tsx` |

---

## Import Order

1. React
2. React Native
3. Expo packages
4. Third-party libraries
5. Internal — `@/components`
6. Internal — `@/theme`
7. Internal — `@/hooks`
8. Internal — `@/types`
9. Internal — `@/utils`
10. Internal — `@/mocks`
11. Internal — `@/navigation`

---

## Pressable

Always import `Pressable` from `react-native-gesture-handler`, not from `react-native`. The RNGH version works correctly inside gesture responders (e.g. `ScrollView`, `SwipeableRow`).

```tsx
// Correct
import { Pressable } from 'react-native-gesture-handler';

// Wrong — will cause gesture conflicts
import { Pressable } from 'react-native';
```

---

## Images

Always use `expo-image`'s `Image` component, not React Native's built-in `Image`. `expo-image` provides better caching, faster decode, and supports blurhash placeholders.

```tsx
import { Image } from 'expo-image';
```

---

## Comments

Write comments only when the **why** is non-obvious. Do not comment what the code does — the code already says that. Comment constraints, workarounds, product decisions, and non-obvious invariants.

```tsx
// Good — explains a non-obvious constraint
// rgba overlay values are intentional media chrome, not semantic design-system colors

// Bad — restates the code
// Set the background color to surface
backgroundColor: colors.surface
```
