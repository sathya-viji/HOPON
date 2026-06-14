# HopOn Design System

The design system is a layered stack. Each layer builds on the one below it. Understanding the layers prevents the most common architectural mistakes.

---

## The Four Layers

```
Layer 4 — Pattern Atoms          IconBox, RolePill, FamiliarFaceItem, DestructiveButton
Layer 3 — Typography API         T.Display, T.LabelLg, T.BodyMd, T.Meta …  (T.*)
Layer 2 — Text Style Presets     textStyles.ts — named presets using Layer 1 values
Layer 1 — Design Tokens          tokens.ts — spacing, colors, fonts, radii, sizes
```

Work top-down when building UI. Work bottom-up when extending the system.

---

## Layer 1 — Design Tokens (`src/theme/tokens.ts`)

The single source of truth for every numeric and color value in the app.

**Exports and their purpose:**

| Export | Purpose |
|---|---|
| `colors` | Raw color palette — primitives and semantic groups |
| `spacing` | Layout gaps, padding — always use these, never literals |
| `radii` | Border radius scale |
| `fontSizes` | Type scale in points |
| `fontFamilies` | Inter weight variants |
| `fontWeights` | Numeric weight values (pair with fontFamilies) |
| `letterSpacing` | Named spacing multipliers — apply as `letterSpacing.heading * fontSize` |
| `lineHeights` | Multiplier scale — apply as `fontSize * lineHeights.body` |
| `borderWidths` | Named border widths |
| `iconSizes` | Icon size scale — use instead of magic numbers |
| `avatarSizes` | Avatar diameter scale |
| `shadow` | Platform-consistent shadow presets |
| `HIT_SLOP` | Named hit slop values for Pressable `hitSlop` prop |
| `CATEGORIES` | Plan category definitions with icon, colors, and dark variants |
| `CATEGORY_PRESETS` | Default form values per category for the Create flow |

**The `colors` object has two kinds of values:**

1. **Global constants** — `colors.coral`, `colors.black`, `colors.green`, `colors.amber`. These never change between light and dark mode; use them directly when you need a fixed value (e.g. the coral CTA button is always coral).

2. **Mode-conditional palettes** — `colors.light.*` and `colors.dark.*`. Do not use these directly in components. Access them through `useTheme()` as `colors.*` — the ThemeContext resolves the correct variant.

**Rule: never use a raw number or hex string where a token exists.**

```tsx
// Wrong
paddingHorizontal: 20
borderRadius: 6
fontSize: 14

// Right
paddingHorizontal: spacing.screenPx
borderRadius: radii.sm
fontSize: fontSizes.body
```

---

## Layer 2 — Text Style Presets (`src/theme/textStyles.ts`)

Named presets that compose token values into complete text style objects. This file is the only place where `fontFamily + fontSize + letterSpacing + lineHeight` are assembled.

**Why this layer exists separately from T.tsx:**

`textStyles.ts` is framework-agnostic (no React imports). Components that need raw style objects (e.g. legacy `StyleSheet.create` inside atoms or inputs) can import from here without importing the `T.*` React components. It is also the single place to update if a text style needs to change across the whole app.

**Adding a new text style:**

Add the preset to `textStyles.ts` first, then add the corresponding `T.*` export to `T.tsx`. Do not add a `T.*` component without a corresponding preset — the preset is what gets tested and reused independently.

---

## Layer 3 — Typography API (`src/components/atoms/T.tsx`)

Thin React wrappers around `textStyles` presets. All text in screens must go through these components. Direct `<Text style={{...}}>` in screen files is not allowed.

**Available components:**

| Component | Semantic role | Default color |
|---|---|---|
| `T.Display` | Celebration / state screen hero titles | `colors.text` |
| `T.PageTitle` | Tab-level screen titles (Profile, Recaps headers) | `colors.text` |
| `T.Heading` | Modal and confirmation screen headings | `colors.text` |
| `T.Subheading` | Card headers, section headings | `colors.text` |
| `T.BodyLg` | Primary body copy — bios, descriptions | `colors.text` |
| `T.BodyMd` | Secondary body copy | `colors.text` |
| `T.LabelLg` | Row/list item primary label | `colors.text` |
| `T.LabelMd` | Standard label, button text | `colors.text` |
| `T.LabelSm` | Small labels, tags | `colors.text` |
| `T.LabelXs` | Extra-small pill labels | `colors.text` |
| `T.CapsLg` | ALL-CAPS section headers | `colors.textSub` |
| `T.CapsSm` | ALL-CAPS smaller section labels | `colors.textSub` |
| `T.Meta` | Handles, neighbourhoods, dates | `colors.textSub` |
| `T.MetaXs` | Dim counts, icon labels | `colors.textDim` |
| `T.StatNum` | Follower / attending counts | `colors.text` |
| `T.Semibold` | Input values, names in mixed contexts | `colors.text` |
| `T.Bold` | Inline bold span inside another `<Text>` | `colors.text` |

**`T.Bold` is special:** it has no size of its own. It inherits font size from a parent `<Text>` via React Native's nested text inheritance. Use it only inside another `T.*` component:

```tsx
<T.BodyLg>
  <T.Bold>{author.name}</T.Bold> joined the plan.
</T.BodyLg>
```

**Override rules:**
- Override `color` via the `color` prop, not `style.color`
- Override size, weight, or spacing only when a genuine one-off is needed — if you find yourself overriding the same thing in multiple places, add a new preset instead

---

## Layer 4 — Pattern Atoms

Opinionated reusable UI pieces that encode specific HopOn product decisions.

| Component | What it encodes |
|---|---|
| `IconBox` | Centred-icon hero container for state/confirm screens. Fixed margin-bottom built in. |
| `RolePill` | Hosted vs. Joined visual badge — colour-codes the user's relationship to a plan |
| `FamiliarFaceItem` | Renders a user who is a "familiar face" — avatar + name + neighbourhood + trust indicators |
| `DestructiveButton` | Danger-zone button with coral colour and confirmation affordance |
| `VerifiedBadge` | Tick badge for verified profiles |

These are not generic atoms. Do not repurpose them for unrelated UI. If you need something similar but different, create a new component rather than adding props to bend these to a new shape.

---

## Semantic Color Groups

### `colors.cost.*`

Encodes the four plan cost types. Always use these for cost-related UI — never reach for `colors.green` or `colors.amber` directly in a cost context, because the cost palette has both light and dark variants resolved by `ThemeContext`.

| Cost type | Token group |
|---|---|
| `free` | `colors.cost.freeBg / freeFg / freeBorder` |
| `copay` | `colors.cost.copayBg / copayFg / copayBorder` |
| `sponsored` | `colors.cost.sponsoredBg / sponsoredFg / sponsoredBorder` |
| `seeking` | `colors.cost.seekingBg / seekingFg / seekingBorder` |

### `colors.ctaBg / ctaFg`

The primary CTA button colours. Adaptive: black/white in light mode, text/bg in dark mode. Use for any primary action button that isn't the coral button variant.

### `colors.joinBtnJoined*` / `colors.joinBtnMine*`

Join button state colours that have precise dark-mode overrides per the prototype design. Do not substitute `colors.cost.free*` for these — the dark-mode values differ from the standard cost palette.

---

## Dark Mode

Dark mode is handled entirely in `ThemeContext`. Components and screens do not contain any `Platform.OS` or `colorScheme` checks for styling purposes. The rule is:

- Always use `colors.*` from `useTheme()` for any color that should adapt
- Only use raw hex/`colorTokens.*` values when a color is intentionally fixed regardless of mode (e.g. `SplashScreen` is a fixed dark branded screen)
- Media chrome colors in story/video screens (`rgba(0,0,0,0.55)` overlays) are fixed by nature — they are acceptable as inline literals
