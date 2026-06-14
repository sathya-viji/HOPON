# Component Development Guidelines

## Component Hierarchy

```
src/components/
  atoms/          Smallest reusable units — single responsibility, no business logic
  atoms/inputs/   Form input atoms — phone, OTP, search, text field
  layout/         Structural primitives — screens reach for these, not View/ScrollView
  molecules/      Compositions of atoms — encode a repeated product pattern
  organisms/      Complex compositions — NavBar, FilterPills
```

The boundary between layers is intentional. When in doubt about which layer something belongs to, ask: does it compose other components from a lower layer? If yes, it belongs in the layer above the highest layer it uses.

---

## Layout Primitives (`src/components/layout/`)

These replace raw `View` and `ScrollView` in screen files. They exist to encode layout conventions as named concepts rather than anonymous style objects.

### `Screen`

Every screen must use `Screen` as its root. It handles:
- Safe area insets (top padding for status bar, bottom for home indicator)
- Optional header slot (rendered above the scrollable body, outside the scroll container)
- Optional footer slot (rendered below the scrollable body, above home indicator padding)
- Keyboard-aware scrolling (`keyboardAware` prop, default `true`)
- Background color from theme

**Props:**

| Prop | Default | Purpose |
|---|---|---|
| `header` | — | Fixed header JSX, rendered above scroll content |
| `footer` | — | Fixed footer JSX, rendered below scroll content |
| `scroll` | `true` | Set to `false` for screens with their own FlatList or non-scrolling content |
| `keyboardAware` | `true` | Wraps body in `KeyboardAwareScrollView`; set to `false` for screens with custom keyboard handling |
| `backgroundColor` | `colors.bg` | Override when a screen has a non-standard background |

**When `scroll={false}`:** the body renders as a plain `View`. The screen is responsible for its own scroll container (typically a `FlatList` or `ScrollView` nested inside the body). This is the pattern for screens with infinite lists.

### `ScreenPad`

Applies the standard horizontal screen padding (`spacing.screenPx = 20`). Use for any content that should align to the screen's horizontal grid. Never hardcode `paddingHorizontal: 20` — always use `ScreenPad` or `spacing.screenPx`.

### `Row`

Horizontal flex container. Default `alignItems: 'center'`. The `gap` prop accepts either a spacing token key (`'sm'`, `'md'`) or a raw number.

### `Stack`

Vertical flex container. No default `alignItems` — children stretch to fill width by default, matching standard column layout. The `gap` prop works the same as `Row`.

**Choosing Row vs Stack:**

- Use `Row` when children sit side by side
- Use `Stack` when children stack vertically
- Do not use `flexDirection` in a screen's inline style as an alternative — always prefer the named primitive

### `SectionBlock`

A padded content section with optional top/bottom borders. Used for distinct content groups within a scrollable screen (e.g. a profile's bio section, a plan's rules section).

### `ScrollContent`

A `ScrollView` pre-configured with `screenPx` horizontal padding and token-based gap. Use for horizontal scrollable rows (category chips, story bubbles). It uses `react-native-gesture-handler`'s `ScrollView` to work correctly inside gesture responders.

### `Spacer`

- `<Spacer size="lg" />` — fixed vertical space using a token key
- `<Spacer flex />` — fills remaining space in a Row/Stack (replaces `flex: 1` on an empty View)
- `<Spacer horizontal size="sm" />` — fixed horizontal space

### `Divider`

Horizontal rule using `borderWidths.thin` and `colors.border`. Use between list sections. Do not use `borderBottomWidth` on a container when `Divider` is the intent.

---

## Atoms (`src/components/atoms/`)

Atoms own their own styling using tokens. They should not accept arbitrary `style` overrides for visual properties — if a visual variation is needed, add a named prop variant, not a style escape hatch.

**Exceptions:** Layout overrides via `style` prop are acceptable when the atom needs to be positioned within a parent layout (e.g. `style={{ flex: 1 }}`). Visual overrides (colors, font sizes, spacing internal to the component) are not.

### `Icon`

Wraps `lucide-react-native`. Always use `iconSizes.*` for the `size` prop. Use inline size only for one-off cases with a clear rationale.

### `Avatar`

Use `avatarSizes.*` for the `size` prop. The `shape` prop accepts `'circle'` or `'square'`. Uses `expo-image` internally.

### `Button`

Variants encode specific semantic actions:
- `primary-coral` — primary CTA (join, create, post)
- `primary` — primary CTA in non-coral contexts
- `secondary` — secondary/cancel action
- `back` — navigation back button (icon only)
- `destructive` — use `DestructiveButton` instead for destruction confirmations

### `T.*` (Typography)

See [Design System Guide](DESIGN_SYSTEM.md#layer-3--typography-api).

---

## Molecules (`src/components/molecules/`)

Molecules encode a repeated product-level pattern. They are allowed to contain business-aware presentation logic (e.g. rendering a plan row knows about `CostType`, `UrgencyTier`).

Key molecules:

| Molecule | Pattern it encodes |
|---|---|
| `PlanRow` | Standard plan list row — activity, location, countdown, cost, spots |
| `HostCard` | Host identity + trust signal, used on the plan detail screen |
| `TrustGrid` | 2×2 or 2×3 grid of trust indicators (plans hosted, attended, mutual connections) |
| `AvatarStack` | Overlapping avatar row showing joiners |
| `SectionHeader` | Label + optional count + optional action link |
| `ScreenHeader` | Back button + centred title — for screens that use the standard header pattern |
| `NotifRow` | Notification list row |
| `TabBar` | Plan feed tab bar (Nearby / Joined / Created) |
| `PulseBar` | Animated activity pulse indicator for the home feed |
| `SettingsRow` | Standard settings list row |

---

## Adding a New Component

1. Decide the layer: atom (single unit), molecule (product pattern), organism (complex composition)
2. Style with tokens only — no raw numbers or hex strings
3. If it renders text, use `T.*` — no raw `<Text>` with inline styles
4. Do not import from `src/screens/`
5. Export from the layer's `index.ts`
6. If it encodes a design decision that future contributors might not understand, add a brief comment explaining the decision (not the code)

---

## What NOT to build as a component

Do not extract a component purely to reduce line count in a screen. A component should have a name that describes a concept, not a position ("TopSection", "BottomCard"). If you find yourself naming a component after its position in a screen, it should probably stay inline in the screen.
