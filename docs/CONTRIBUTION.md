# Contribution Guidelines

## Before You Start

1. Read [ONBOARDING.md](ONBOARDING.md) if this is your first session in the codebase
2. Read [ANTI_PATTERNS.md](ANTI_PATTERNS.md) — it contains the most common mistakes
3. Run `npx tsc --noEmit` before and after your changes to confirm you haven't introduced type errors

---

## Adding a Screen

1. Create `src/screens/<domain>/<ScreenName>Screen.tsx`
2. Add route and params to `src/navigation/types.ts`
3. Register in the appropriate stack (HomeStack, RecapsStack, ProfileStack, or OnboardingNavigator)
4. Use `<Screen>` as root; `header=` and `footer=` props for fixed bars
5. Layout with `Row`, `Stack`, `ScreenPad` only — no raw `View` with inline styles
6. All text via `T.*` — no raw `<Text>` with inline styles
7. Colors from `const { colors } = useTheme()` — no hardcoded hex
8. Spacing via `spacing.*`, radii via `radii.*`, icon sizes via `iconSizes.*`

---

## Adding a Component

1. Decide the layer: atom (single unit) / molecule (product pattern) / organism (complex)
2. Style with tokens only — import from `@/theme/tokens`
3. Colors from `useTheme()` if adaptive, from `colorTokens.*` only if intentionally fixed
4. Text via `T.*` or `textStyles.*` — no raw font/size/weight
5. Export from the layer's `index.ts`
6. If the component encodes a non-obvious product decision, add a one-line comment explaining it

---

## Extending the Design System

### Adding a token
Add to the relevant export in `tokens.ts`. Tokens must be named for their **role**, not their value:

```ts
// Good — name describes role
spacing.cardGap: 10

// Bad — name describes value
spacing.ten: 10
```

### Adding a text style preset
1. Add the preset object to `textStyles.ts`
2. Add the corresponding `T.*` export to `T.tsx`
3. Both steps are always required together

### Adding a color
- Global brand color → add to the `colors` root object
- Mode-conditional color → add to `colors.light` and `colors.dark`, then add to `ThemeColors` interface and `ThemeProvider` mapping in `ThemeContext.tsx`
- Semantic group color (a new cost type, a new status) → add as a sub-group following the `colors.cost.*` pattern

---

## Adding a Route to an Existing Screen

Some screens are accessed from multiple stacks (e.g. `ProfileOther` is in HomeStack, RecapsStack, and ProfileStack). When adding a new cross-stack route:

1. Add the screen and its params to the target stack's param list in `types.ts`
2. Import and register the screen in the target stack's navigator file
3. Do not share screen registration between stacks — each stack registers its own copy

---

## TypeScript

- Run `npx tsc --noEmit` before committing. Zero output = zero errors.
- Do not use `as any` or `// @ts-ignore`. If TypeScript is fighting you, the type design needs to change.
- Navigation params must be typed — never use `route.params as any`

---

## What Needs a PR Review

Any change to:
- `src/theme/tokens.ts` — token changes affect the entire codebase
- `src/theme/ThemeContext.tsx` — dark mode regressions are invisible without a review
- `src/navigation/types.ts` — navigation contract changes
- `src/types/*.ts` — domain model changes affect mocks, screens, and the future API contract
- Any shared component used in more than 5 screens

Single-screen additions and bug fixes that don't touch shared infrastructure can be merged with a lighter review.
