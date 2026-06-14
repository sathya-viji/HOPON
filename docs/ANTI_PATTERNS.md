# Anti-Patterns

These are the most likely mistakes a contributor can make. Each has a before/after example.

---

## 1. StyleSheet.create in a screen file

**Wrong:**
```tsx
// PlanScreen.tsx
const styles = StyleSheet.create({
  title: { fontFamily: 'Inter-Bold', fontSize: 18 },
  container: { paddingHorizontal: 20, backgroundColor: '#F5F5F5' },
});
```

**Right:**
```tsx
// PlanScreen.tsx — screens own zero styles
<ScreenPad style={{ backgroundColor: colors.surface }}>
  <T.Subheading>{plan.activity}</T.Subheading>
</ScreenPad>
```

**Why it matters:** When a screen owns styles, design-system changes (token renames, dark mode additions) must be applied to every screen individually. With layout primitives and `T.*`, they propagate automatically.

---

## 2. Hardcoded color values

**Wrong:**
```tsx
<View style={{ backgroundColor: '#F5F5F5' }} />
<Text style={{ color: '#888888' }} />
```

**Right:**
```tsx
<View style={{ backgroundColor: colors.surface }} />
<T.Meta>some text</T.Meta>  {/* Meta defaults to colors.textSub */}
```

**Why it matters:** `#F5F5F5` is the light mode surface color. In dark mode it should be `#1A1A1A`. Hardcoded values break dark mode silently.

---

## 3. Raw `<Text>` for styled content

**Wrong:**
```tsx
<Text style={{ fontFamily: 'Inter-Bold', fontSize: 14, color: colors.text }}>
  Plan title
</Text>
```

**Right:**
```tsx
<T.LabelLg>Plan title</T.LabelLg>
```

**Why it matters:** Raw `<Text>` with inline styles creates visual inconsistency. Two engineers independently hardcoding `fontSize: 14, fontFamily: 'Inter-Bold'` will produce subtly different results over time (letter spacing, line height, weight variations). `T.*` components guarantee consistency.

---

## 4. Using `colors.green` instead of `colors.cost.freeFg`

**Wrong:**
```tsx
// In a cost badge for a free plan
<Text style={{ color: colors.green }}>Free</Text>
```

**Right:**
```tsx
<Text style={{ color: colors.cost.freeFg }}>Free</Text>
```

**Why it matters:** `colors.cost.freeFg` is `#006644` in light mode and `#34D399` in dark mode. `colors.green` is always `#00A878`. They are different values serving different purposes. `colors.green` is a global brand accent; `colors.cost.free*` is a semantic set for cost-type UI.

---

## 5. Importing `Pressable` from `react-native`

**Wrong:**
```tsx
import { Pressable } from 'react-native';
```

**Right:**
```tsx
import { Pressable } from 'react-native-gesture-handler';
```

**Why it matters:** React Native's `Pressable` conflicts with gesture responders. Inside `ScrollView` or swipeable containers, taps may not register or may cause gesture cancellation. Always use the RNGH version.

---

## 6. Using `flexDirection: 'row'` inline instead of `<Row>`

**Wrong:**
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
```

**Right:**
```tsx
<Row gap="md">
```

**Why it matters:** `<Row>` is an intentional layout primitive that uses named gap values. Inline `flexDirection` is an unnamed style object that accumulates across the codebase with no consistency guarantee.

---

## 7. Cross-layer imports

**Wrong:**
```tsx
// In a component file
import { HomeScreen } from '@/screens/home/HomeScreen';

// In tokens.ts
import { useTheme } from './ThemeContext';
```

**Right:** Dependencies flow downward only. Components never import from screens. The design system layer never imports from components.

---

## 8. Adding navigation logic to a component

**Wrong:**
```tsx
// Inside PlanRow.tsx
import { useNavigation } from '@react-navigation/native';
function PlanRow({ planId }) {
  const nav = useNavigation();
  return <Pressable onPress={() => nav.navigate('Plan', { planId })} />;
}
```

**Right:**
```tsx
// PlanRow receives onPress from the screen
function PlanRow({ onPress }) {
  return <Pressable onPress={onPress} />;
}
// Screen owns the navigation call
<PlanRow onPress={() => navigation.navigate('Plan', { planId: plan.id })} />
```

**Why it matters:** Components with embedded navigation cannot be reused across different stacks (e.g. `PlanRow` appears in `HomeStack` and `ProfileStack`). Navigation calls belong in screens.

---

## 9. Creating a component to reduce line count

**Wrong:** Extracting a `<PlanScreenTopSection>` component because `PlanScreen.tsx` is long.

**Right:** A component should represent a concept with a clear name and a reason to be reused. If the only reason is line count, keep it inline. Premature extraction creates indirection without benefit.

---

## 10. Adding a domain sub-folder inside `components/`

**Wrong:**
```
src/components/
  atoms/plan/
  atoms/profile/
```

**Right:**
```
src/components/
  atoms/
    PlanRow.tsx
    Avatar.tsx
```

**Why it matters:** Components are domain-agnostic by design. Domain sub-folders create artificial import barriers and discourage reuse. `Avatar` is used across plans, profiles, chats, and recaps — it doesn't belong to any one domain.
