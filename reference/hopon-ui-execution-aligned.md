# HopOn — UI Execution Document
**React Native (Expo) · React Navigation · 100% Custom Components**
**Version 2.0 · Living Document**

---

## 0. How to Use This Document

Every Claude Code session opens with:
> "Read CONTEXT.md before writing any code. Follow every rule in it without exception."

When there is a conflict between this document and any other source:
- **Visual decisions** → this document + HTML prototype win
- **Behaviour and logic** → PRD wins
- **Never guess** — if something is not covered here, ask before implementing

### Screen review rule — MANDATORY

After completing each screen, Claude Code must:

1. Ensure the Expo dev server is running (`npx expo start`).
2. Print the following message and then **stop**. Do not proceed to the next screen until the user explicitly says to continue:

```
✅ [ScreenName] is ready for review.

Open Expo Go on your device or simulator and navigate to this screen.

- iOS simulator: press `i` in the terminal
- Android emulator: press `a` in the terminal
- Physical device: scan the QR code in the terminal with Expo Go

Reply "looks good" to move to the next screen, or describe any changes needed.
```

3. If the user requests changes, apply them and repeat the review message.
4. Only move to the next screen once the user has explicitly approved the current one.

This rule applies to every screen in the build order without exception — including skeleton/empty states and onboarding screens.

---

## 1. Expo Dependencies

Install all of these before writing a single component. Do not add packages later — Claude Code will make inconsistent choices if packages appear mid-build.

```bash
npx create-expo-app hopon --template blank-typescript
cd hopon

npx expo install \
  expo-font \
  @expo-google-fonts/inter \
  expo-status-bar \
  expo-haptics \
  expo-image-picker \
  expo-image \
  expo-location \
  expo-splash-screen \
  expo-linking \
  expo-contacts \
  react-native-safe-area-context \
  react-native-screens \
  react-native-reanimated \
  react-native-gesture-handler \
  react-native-maps \
  @gorhom/bottom-sheet \
  @react-navigation/native \
  @react-navigation/stack \
  @react-navigation/bottom-tabs \
  react-native-keyboard-controller
```

### Package responsibilities (Claude Code must use these, not alternatives)

| Package | Purpose | Never substitute with |
|---|---|---|
| `expo-image` | All `<Image>` rendering | RN's built-in `Image` |
| `react-native-reanimated` | All animations | RN's `Animated` API |
| `react-native-gesture-handler` | All gestures + Pressable | `TouchableOpacity`, `TouchableHighlight` |
| `@gorhom/bottom-sheet` | CreateSheet + map card | Custom modal |
| `react-native-keyboard-controller` | Keyboard avoid | `KeyboardAvoidingView` |
| `expo-haptics` | Haptic feedback | Any other haptics lib |
| `expo-image-picker` | Photo upload | Any other image picker |

### `app.json` required config

```json
{
  "expo": {
    "name": "hopon",
    "slug": "hopon",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "splash": {
      "backgroundColor": "#FF4D2E"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FF4D2E"
      },
      "package": "com.hopon.app"
    },
    "ios": {
      "bundleIdentifier": "com.hopon.app",
      "supportsTablet": false
    },
    "plugins": [
      "react-native-reanimated",
      ["react-native-gesture-handler"],
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "HopOn uses your location to show nearby plans." }],
      ["expo-contacts", { "contactsPermission": "HopOn checks your contacts to find friends already on the app." }],
      ["expo-image-picker", { "photosPermission": "HopOn needs photo access to let you post recaps and set your profile picture." }]
    ]
  }
}
```

---

## 2. Project Structure

```
src/
├── theme/
│   ├── tokens.ts          # ALL design values — no raw value appears anywhere else
│   ├── ThemeContext.tsx    # Provider + useTheme hook — full implementation here
│   └── index.ts           # re-exports everything
│
├── components/
│   ├── layout/
│   │   └── Screen.tsx     # THE layout primitive — every screen uses this, no exceptions
│   ├── atoms/             # zero logic, zero state, props in → UI out
│   │   ├── Countdown.tsx
│   │   ├── CostTag.tsx
│   │   ├── TrustPill.tsx
│   │   ├── SpotsBadge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── ActivityIcon.tsx
│   │   ├── LiveDot.tsx
│   │   ├── Icon.tsx        # wraps all Lucide icons — single import point
│   │   ├── EmptyState.tsx
│   │   ├── SkeletonRow.tsx
│   │   ├── Toast.tsx
│   │   └── inputs/
│   │       ├── TextInput.tsx
│   │       ├── PhoneInput.tsx
│   │       ├── OtpInput.tsx
│   │       ├── FieldRow.tsx
│   │       └── SearchBar.tsx
│   ├── molecules/
│   │   ├── PlanRow.tsx
│   │   ├── PlanMeta.tsx
│   │   ├── AvatarStack.tsx
│   │   ├── HostCard.tsx
│   │   ├── TrustGrid.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── PulseBar.tsx
│   │   ├── FamiliarFacesBanner.tsx
│   │   ├── NotifRow.tsx
│   │   ├── SettingsRow.tsx
│   │   ├── StoryBubble.tsx
│   │   ├── EndorsementTag.tsx
│   │   ├── GenderBadge.tsx
│   │   └── TabBar.tsx       # in-screen tab bar (not the bottom nav)
│   └── organisms/
│       ├── NavBar.tsx
│       ├── FilterPills.tsx
│       ├── PlanList.tsx
│       ├── MapView.tsx
│       ├── StoryStrip.tsx
│       └── CreateSheet.tsx
│
├── screens/
│   ├── onboarding/
│   ├── home/
│   ├── plan/
│   ├── recaps/
│   ├── profile/
│   ├── notifications/
│   ├── chat/
│   └── settings/
│
├── navigation/
│   ├── RootNavigator.tsx
│   ├── OnboardingNavigator.tsx
│   ├── MainNavigator.tsx     # bottom tabs
│   ├── HomeStack.tsx
│   ├── RecapsStack.tsx
│   ├── ProfileStack.tsx
│   └── types.ts              # all route param types
│
├── hooks/
│   ├── useCountdown.ts       # ticks every second
│   ├── usePlanStatus.ts      # derives urgency from minutesUntilStart
│   ├── useTheme.ts           # re-export from ThemeContext
│   ├── useToast.ts           # imperative toast trigger
│   └── useBackHandler.ts     # Android back button
│
├── utils/
│   ├── time.ts               # timeAgo, formatDate, countdownLabel
│   ├── plan.ts               # deriveUrgency, getCostInfo, getGenderLabel
│   └── avatar.ts             # initials fallback, placeholder URI
│
├── types/
│   ├── plan.ts
│   ├── user.ts
│   ├── notification.ts
│   ├── recap.ts
│   └── index.ts
│
└── mocks/
    ├── plans.ts
    ├── users.ts
    ├── recaps.ts
    ├── notifications.ts
    └── index.ts
```

---

## 3. Design Tokens (`src/theme/tokens.ts`)

The only file that contains raw values. Everything else imports from here. No hex color, pixel value, or font weight is written anywhere else in the codebase.

```typescript
export const colors = {
  // Brand — fixed, identical in light and dark
  coral:  '#FF4D2E',
  black:  '#0A0A0A',
  green:  '#00A878',
  amber:  '#C47800',

  // Light mode neutrals
  light: {
    bg:         '#FFFFFF',
    surface:    '#F5F5F5',
    surfaceMid: '#F0F0F0',
    border:     '#EBEBEB',
    borderMid:  '#D0D0D0',
    text:       '#0A0A0A',
    textSub:    '#888888',
    textDim:    '#BBBBBB',
    textGhost:  '#DDDDDD',
  },

  // Dark mode neutrals
  dark: {
    bg:         '#0A0A0A',
    surface:    '#1A1A1A',
    surfaceMid: '#222222',
    border:     '#2A2A2A',
    borderMid:  '#3A3A3A',
    text:       '#F0F0F0',
    textSub:    '#666666',
    textDim:    '#3A3A3A',
    textGhost:  '#2A2A2A',
  },

  // Semantic cost — bg/fg pairs (unchanged in dark mode)
  cost: {
    freeBg:       '#DCFFF4', freeFg:       '#006644',
    copayBg:      '#FFF4DC', copayFg:      '#7A4F00',
    sponsoredBg:  '#FFE8E4', sponsoredFg:  '#B02000',
    seekingBg:    '#F0F0F0', seekingFg:    '#555555',
    // Dark mode overrides
    darkFreeBg:      '#0A2318', darkFreeFg:      '#34D399',
    darkCopayBg:     '#241A00', darkCopayFg:     '#F5C842',
    darkSponsoredBg: '#2A0A06', darkSponsoredFg: '#F87171',
    darkSeekingBg:   '#1C1C1C', darkSeekingFg:   '#999999',
  },

  // Semantic gender badge
  gender: {
    womenBg: '#FCE4EC', womenFg: '#C2185B',
    menBg:   '#E3F2FD', menFg:   '#1565C0',
  },

  // Joined row tint
  joinedRowBg:     '#F8FFFC',
  joinedRowBgDark: '#071A11',

  // White (always white, regardless of mode)
  white: '#FFFFFF',
} as const;

export const radii = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   16,
  xxl:  24,
  full: 999,
} as const;

export const spacing = {
  screenPx: 20,    // horizontal page padding — all screens use this
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
} as const;

export const layout = {
  navBarHeight:   72,   // bottom nav bar height (excludes home indicator — Screen adds insets.bottom on top)
  minTapTarget:   44,   // minimum touchable dimension (WCAG)
} as const;

// ⚠️ NEVER use phoneWidth, phoneHeight, statusBarHeight, homeIndicator, or usableHeight constants.
// Screen dimensions vary by device. Always use:
//   - flex:1 instead of fixed height on containers
//   - useSafeAreaInsets() from react-native-safe-area-context for top/bottom insets
//   - The Screen component (src/components/layout/Screen.tsx) which handles all insets automatically
//
// Example — correct inset usage if you ever need raw values:
//   const insets = useSafeAreaInsets();
//   paddingTop: insets.top        // status bar + notch/Dynamic Island
//   paddingBottom: insets.bottom  // home indicator (34px on notch iPhones, 0 on older/Android)

export const fontSizes = {
  xxs:  9,
  xs:   10,
  sm:   11,
  base: 12,
  md:   13,
  lg:   15,
  xl:   18,
  xxl:  22,
  xxxl: 26,
} as const;

export const fontWeights = {
  regular:   '400' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
} as const;

export const letterSpacing = {
  sectionHeader: 0.12,   // multiply by fontSize: 12px * 0.12 = 1.44
  tags:          0.08,
  cta:           0.04,
  meta:          0.02,
} as const;

// Category registry — used by ActivityIcon and CreateSheet
export const CATEGORIES = [
  { id: 'sports',        label: 'Sports & fitness', icon: 'dumbbell',     bg: '#E8F5E9', iconColor: '#2E7D32' },
  { id: 'food',          label: 'Food & drinks',    icon: 'utensils',     bg: '#FFF4DC', iconColor: '#B8860B' },
  { id: 'entertainment', label: 'Entertainment',    icon: 'clapperboard', bg: '#EEF2FF', iconColor: '#4527A0' },
  { id: 'outdoors',      label: 'Outdoors',         icon: 'trees',        bg: '#F0FFF4', iconColor: '#1B5E20' },
  { id: 'learning',      label: 'Learning',         icon: 'book-open',    bg: '#F0F8FF', iconColor: '#01579B' },
  { id: 'social',        label: 'Social',           icon: 'users',        bg: '#FFF5F3', iconColor: '#880E4F' },
  { id: 'arts',          label: 'Arts & culture',   icon: 'palette',      bg: '#FFF8E1', iconColor: '#E65100' },
  { id: 'other',         label: 'Other',            icon: 'sparkles',     bg: '#F5F5F5', iconColor: '#555555' },
] as const;
// Interests screen: Continue button disabled until ≥2 categories selected. No error toast — button simply stays inactive.

// Plan creation presets per category
export const CATEGORY_PRESETS: Record<string, { when: string; spots: number; cost: string }> = {
  sports:        { when: '1hr',     spots: 4, cost: 'free'    },
  food:          { when: 'now',     spots: 4, cost: 'free'    },
  entertainment: { when: 'tonight', spots: 3, cost: 'copay'   },
  outdoors:      { when: '30min',   spots: 5, cost: 'free'    },
  learning:      { when: '1hr',     spots: 3, cost: 'free'    },
  social:        { when: 'tonight', spots: 6, cost: 'free'    },
  arts:          { when: 'tonight', spots: 4, cost: 'free'    },
  other:         { when: 'now',     spots: 3, cost: 'free'    },
};
```

---

## 4. Theme Context (`src/theme/ThemeContext.tsx`)

Full implementation. Every component calls `useTheme()` — never checks `colorScheme` directly.

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { colors as colorTokens } from './tokens';

type ColorMode = 'light' | 'dark';

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceMid: string;
  border: string;
  borderMid: string;
  text: string;
  textSub: string;
  textDim: string;
  textGhost: string;
  // Brand always fixed
  coral: string;
  black: string;
  green: string;
  amber: string;
  white: string;
  // Cost semantic (mode-aware)
  cost: {
    freeBg: string;    freeFg: string;
    copayBg: string;   copayFg: string;
    sponsoredBg: string; sponsoredFg: string;
    seekingBg: string; seekingFg: string;
  };
  gender: typeof colorTokens.gender;
  joinedRowBg: string;
}

interface Theme {
  colors: ThemeColors;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ColorMode>(systemScheme === 'dark' ? 'dark' : 'light');

  const isDark = mode === 'dark';
  const neutral = isDark ? colorTokens.dark : colorTokens.light;

  const colors: ThemeColors = {
    ...neutral,
    coral:  colorTokens.coral,
    black:  colorTokens.black,
    green:  colorTokens.green,
    amber:  colorTokens.amber,
    white:  colorTokens.white,
    cost: isDark ? {
      freeBg:       colorTokens.cost.darkFreeBg,
      freeFg:       colorTokens.cost.darkFreeFg,
      copayBg:      colorTokens.cost.darkCopayBg,
      copayFg:      colorTokens.cost.darkCopayFg,
      sponsoredBg:  colorTokens.cost.darkSponsoredBg,
      sponsoredFg:  colorTokens.cost.darkSponsoredFg,
      seekingBg:    colorTokens.cost.darkSeekingBg,
      seekingFg:    colorTokens.cost.darkSeekingFg,
    } : {
      freeBg:       colorTokens.cost.freeBg,
      freeFg:       colorTokens.cost.freeFg,
      copayBg:      colorTokens.cost.copayBg,
      copayFg:      colorTokens.cost.copayFg,
      sponsoredBg:  colorTokens.cost.sponsoredBg,
      sponsoredFg:  colorTokens.cost.sponsoredFg,
      seekingBg:    colorTokens.cost.seekingBg,
      seekingFg:    colorTokens.cost.seekingFg,
    },
    gender:       colorTokens.gender,
    joinedRowBg:  isDark ? colorTokens.joinedRowBgDark : colorTokens.joinedRowBg,
  };

  return (
    <ThemeContext.Provider value={{
      colors,
      mode,
      setMode,
      toggleMode: () => setMode(m => m === 'light' ? 'dark' : 'light'),
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
```

---

## 5. The Screen Primitive (`src/components/layout/Screen.tsx`)

Every screen uses this. It is never modified after initial creation.

```typescript
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTheme } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  header?: React.ReactNode;    // fixed top — never scrolls
  footer?: React.ReactNode;    // fixed bottom — never scrolls
  scroll?: boolean;            // default true — set false for map screens
  keyboardAware?: boolean;     // default true — wraps body in keyboard-aware scroll
  backgroundColor?: string;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  keyboardAware = true,
  backgroundColor,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bg = backgroundColor ?? colors.bg;

  // If there's a footer (NavBar, CTA), the footer slot adds insets.bottom itself.
  // If no footer, the scroll body must pad by insets.bottom + breathing room so
  // content never hides behind the home indicator.
  const bottomPad = footer ? 0 : insets.bottom + 16;

  const body = scroll ? (
    keyboardAware ? (
      <KeyboardAwareScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        {children}
      </ScrollView>
    )
  ) : (
    // Non-scrolling screens (map, full-screen story viewer):
    // paddingBottom added so content never hides behind home indicator
    <View style={[styles.body, { paddingBottom: footer ? 0 : insets.bottom }]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header sits above content and gets top safe area padding.
          This pushes content below the notch / Dynamic Island / status bar. */}
      {header && (
        <View style={[styles.headerSlot, { paddingTop: insets.top }]}>
          {header}
        </View>
      )}
      {/* If no header, body must still clear the status bar */}
      {!header && <View style={{ height: insets.top }} />}
      {body}
      {footer && (
        <View style={[styles.footerSlot, { paddingBottom: insets.bottom }]}>
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, overflow: 'hidden' },
  headerSlot: { flexShrink: 0, zIndex: 10 },
  body:       { flex: 1 },
  footerSlot: { flexShrink: 0, zIndex: 10 },
});
```

### Screen usage pattern

```typescript
export function HomeScreen() {
  return (
    <Screen
      header={<HomeHeader />}
      footer={<NavBar active="home" />}
    >
      {/* Never worry about overflow, safe areas, or nav height */}
    </Screen>
  );
}

// Non-scrolling screen (map, chat):
export function HomeMapScreen() {
  return (
    <Screen header={<MapHeader />} footer={<NavBar active="map" />} scroll={false}>
      <MapView />
    </Screen>
  );
}

// Screen with keyboard input (onboarding, chat):
export function SignupNameScreen() {
  return (
    <Screen header={<OnboardingHeader step={3} />} footer={<ContinueButton />} keyboardAware>
      {/* inputs here — keyboard pushes content up automatically */}
    </Screen>
  );
}
```

---

## 6. Layout Rules (Hard Rules — No Exceptions)

### 6.1 Safe area rules

| Rule | Correct | Wrong |
|---|---|---|
| Safe area top | `Screen` handles via `insets.top` — content always clears status bar / notch / Dynamic Island | Never add `paddingTop` for status bar in a screen component |
| Screen with no header | `Screen` inserts `<View style={{ height: insets.top }} />` automatically | Never render content flush to the top of the screen |
| Safe area bottom | `Screen footer` slot adds `insets.bottom` — content never hides behind home indicator | Never add raw `paddingBottom` to clear the home indicator |
| Nav bar clearance | `Screen footer` slot | Never add `paddingBottom: 72` or any fixed value in screen body |
| CTA buttons | Always in `Screen footer` slot | Never `position: absolute, bottom: 0` — this breaks on devices with a home indicator |
| Keyboard handling | `Screen keyboardAware={true}` | Never add `KeyboardAvoidingView` in a screen — Screen handles it |

### 6.2 Overflow and clipping rules

| Rule | Correct | Wrong |
|---|---|---|
| Container heights | `flex: 1` or natural height | Never fixed `height: Npx` on any container that wraps content — it will clip on smaller screens |
| Minimum heights | `minHeight` if a floor is needed | Never `height` — use `minHeight` so taller content can expand |
| Text containers | No fixed height — let text wrap naturally | Never constrain a text container with `height` |
| Horizontal overflow | `flexWrap: 'wrap'` or `FlatList horizontal` | Never let a `flexDirection: row` exceed screen width without wrapping or scroll |
| `overflow: hidden` | Only on containers with `borderRadius` that need clipping (avatars, cards) | Never on screen root or scroll containers — it will clip content |
| Absolute positioned elements | Must account for `insets` if near top or bottom edges | Never `top: 0` or `bottom: 0` without adding the relevant inset |

### 6.3 Flexbox alignment rules

| Rule | Correct | Wrong |
|---|---|---|
| Screen root | `flex: 1` — fills entire available space | Never forget `flex: 1` on the root `View` — without it the screen collapses to zero height |
| Scrollable screen body | `flex: 1` on `ScrollView` itself + `flexGrow: 1` on `contentContainerStyle` | Never `flex: 1` on `contentContainerStyle` — it prevents the scroll area from growing |
| Centering content vertically | `justifyContent: 'center'` on parent with `flex: 1` | Never use `marginTop: 'auto'` — it behaves inconsistently across Android / iOS |
| Row alignment | `alignItems: 'center'` for vertically centred rows | Never omit `alignItems` on `flexDirection: row` — default is `stretch` which distorts children |
| Spacer between elements | `gap: N` (RN 0.71+) or `flex: 1` on a spacer `View` | Never `marginLeft: 'auto'` on a flex child — inconsistent on Android |
| Icon + text rows | `flexDirection: row`, `alignItems: center`, explicit `gap` | Never rely on default alignment — always set it explicitly |

### 6.4 Text overflow rules

| Rule | Correct | Wrong |
|---|---|---|
| Long text in a row | `flex: 1` + `numberOfLines={1}` + `ellipsizeMode="tail"` on the `Text` | Never put unbounded text in a `flexDirection: row` without `flex: 1` — it pushes siblings off screen |
| Plan name / user name | Always `numberOfLines={1}` + `ellipsizeMode="tail"` | Never assume names are short |
| Multi-line body text | `numberOfLines` only if intentionally clamped, else let it wrap | Never fixed `height` on a text block |
| `Text` inside `Text` | Only for inline bold/colour spans | Never nest `Text` for layout purposes — use `View` |

### 6.5 Android-specific rules

| Rule | Detail |
|---|---|
| Status bar overlap | On Android, React Navigation does not automatically add status bar padding. `Screen` handles this via `insets.top` from `useSafeAreaInsets()` — this is why every screen must use `Screen`. |
| Elevation / shadow | Use `elevation` for Android shadows, not `boxShadow`. Tokens provide both: `shadow.sm`, `shadow.md`, `shadow.lg`. Never write raw `shadow*` props — they are iOS-only and silently ignored on Android. |
| Font rendering | Android renders fonts slightly heavier. Never compensate with `fontWeight` adjustments — use the token weight values which are tested on both platforms. |
| Bottom nav overlap | Some Android OEM skins add their own navigation bar. `insets.bottom` accounts for this. If `insets.bottom === 0` on Android the device uses gesture nav — content is already clear. |
| `borderRadius` on `overflow: hidden` | Android clips children correctly only when `overflow: hidden` is set explicitly on the container with `borderRadius`. Always set both together on card/avatar containers. |

### 6.6 FlatList rules

| Rule | Correct | Wrong |
|---|---|---|
| List root | `FlatList` with `flex: 1` | Never `ScrollView` wrapping mapped components for lists of plans/notifs/recaps |
| Bottom clearance in list | `contentContainerStyle={{ paddingBottom: insets.bottom + layout.navBarHeight }}` | Never forget bottom padding — last item hides behind NavBar |
| Empty state | `ListEmptyComponent` prop on `FlatList` | Never conditional render outside FlatList |
| Nested scroll | Never nest a `FlatList` / `ScrollView` inside a `ScrollView` in the same axis | Use `nestedScrollEnabled={true}` only when unavoidable (different axes) |

### 6.7 Modal and sheet rules

| Rule | Detail |
|---|---|
| Bottom sheets | Use `position: absolute, bottom: 0, left: 0, right: 0` on the sheet container inside a full-screen overlay `View`. Add `paddingBottom: insets.bottom` to the sheet itself. |
| Backdrop | `position: absolute, top: 0, left: 0, right: 0, bottom: 0`, `zIndex: 50`, semi-transparent bg. Always below sheet `zIndex`. |
| Sheet on Android | Test on Android — keyboard pushing a sheet up requires `keyboardAware` on the overlay, not on `Screen`. |
| Modal safe area | If using RN `Modal`, wrap content in `<SafeAreaView>` from `react-native-safe-area-context` — not RN's own `SafeAreaView`. |

---

## 7. Icon System (`src/components/atoms/Icon.tsx`)

All icons are Lucide. Single import point — never import from lucide-react-native directly in screens or molecules.

```typescript
import {
  AlertTriangle, BadgeCheck, Ban, Banknote, BookOpen,
  Camera, Check, ChevronLeft, ChevronRight, CircleCheck,
  Clock, Crosshair, Flag, Heart, Image, ImagePlus, Info,
  Link, List, Lock, Map, MapPin, MessageCircle, Pencil,
  Percent, Plus, Search, Send, Settings, ShieldCheck,
  Sparkles, User, Users, X, XCircle, Zap,
  // Additional needed
  Dumbbell, Utensils, Trees, Palette, Bell, LogOut, UserPlus,
  SlidersHorizontal, Share2, MoreHorizontal, ClapperBoard,
} from 'lucide-react-native';

export type IconName =
  | 'alert-triangle' | 'badge-check' | 'ban' | 'banknote'
  | 'book-open' | 'camera' | 'check' | 'chevron-left'
  | 'chevron-right' | 'circle-check' | 'clock' | 'crosshair'
  | 'flag' | 'heart' | 'image' | 'image-plus' | 'info'
  | 'link' | 'list' | 'lock' | 'map' | 'map-pin'
  | 'message-circle' | 'pencil' | 'percent' | 'plus'
  | 'search' | 'send' | 'settings' | 'shield-check'
  | 'sparkles' | 'user' | 'users' | 'x' | 'x-circle' | 'zap'
  | 'dumbbell' | 'utensils' | 'trees' | 'palette' | 'bell'
  | 'log-out' | 'user-plus' | 'sliders-horizontal'
  | 'share-2' | 'more-horizontal' | 'clapperboard';

const ICON_MAP: Record<IconName, React.ComponentType<any>> = {
  'alert-triangle': AlertTriangle,
  // ... map all names
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.75 }: IconProps) {
  const Component = ICON_MAP[name];
  if (!Component) return null;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
```

---

## 8. Input Atom Specs (`src/components/atoms/inputs/`)

### 8.1 TextInput

States: default → focused (black border) → filled → error (coral border + error text below).

```typescript
interface TextInputProps {
  label?: string;          // uppercase small label above field
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;          // shows below field in coral
  maxLength?: number;
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
}
```

Field container: surface bg, 1.5px border (`colors.border`), `radii.sm`, 13px padding. On focus: border color → `colors.black`. Height: 48px minimum.

### 8.2 PhoneInput

`+91` prefix (fixed, non-editable, grey text) | divider | tel input. Same container style as TextInput. `keyboardType="phone-pad"`.

### 8.3 OtpInput

6 individual cells. Each cell: `flex:1`, `aspectRatio:1`, surface bg, 1.5px border, `radii.sm`, 22px bold centered text. Active cell (cursor position): black border. Filled cell: black border + text. One hidden `TextInput` with `opacity:0` captures all keystrokes and distributes digits to cells.

### 8.4 FieldRow

Used in CreateSheet and Settings. Tappable row that opens a picker/sheet.

```typescript
interface FieldRowProps {
  icon?: IconName;
  label: string;          // uppercase small label
  value?: string;         // filled value (black text)
  placeholder?: string;   // unfilled (dim text)
  onPress: () => void;
}
```

States: default (border: `colors.border`) → selected/filled (border: `colors.black`, bg: `colors.surfaceMid`).

### 8.5 SearchBar

```typescript
interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}
```

States: inactive (surface bg, dim border) → active (bg: `colors.bg`, border: `colors.black`, subtle shadow). Search icon on left, × clear button appears when value is non-empty.

---

## 9. Atom Specs

### 9.1 Button

```typescript
type ButtonVariant =
  | 'primary'         // black bg, white text, full width
  | 'primary-coral'   // coral bg, white text, full width — for NOW/HOP ON
  | 'secondary'       // surface bg, 1.5px border, full width
  | 'join'            // black bg, white text, inline (plan list)
  | 'join-joined'     // green tint bg + border, green text
  | 'join-mine'       // amber tint bg + border, amber text
  | 'join-full'       // surface bg, dim text, not pressable
  | 'back'            // 34×34 circle, surface bg, chevron-left icon

interface ButtonProps {
  variant: ButtonVariant;
  label?: string;         // not required for 'back'
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}
```

**Press animation (all variants except 'join-full' and 'back'):**
- `useAnimatedStyle` + `useSharedValue`
- `onPressIn`: `withSpring(0.97, { damping: 15, stiffness: 400 })`
- `onPressOut`: `withSpring(1.0, { damping: 15, stiffness: 400 })`
- `useNativeDriver: true`

**Minimum height:** `layout.minTapTarget` (44px) for all variants.

**Haptics:**
- `primary`, `primary-coral`: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on press
- `join` → confirm: `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)`
- All others: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`

### 9.2 Countdown

```typescript
// Urgency thresholds (from PRD):
// now  = minutesUntilStart ≤ 30  → coral pill "NOW" or "Xm", pulse animation
// soon = minutesUntilStart ≤ 60  → amber text, no pill
// later = > 60 min               → textDim, shows "Tue 7 PM" label instead

interface CountdownProps {
  minutesUntilStart: number;
}
```

"NOW" pill: coral bg, white text, `radii.xs`, bold 800, letter-spacing 0.04em, pulse animation (opacity 1→0.5, scale 1→0.8, loop 1.5s).

Digit change animation: `withTiming` opacity 0.3→1 + translateY -3→0, 120ms.

### 9.3 EmptyState

```typescript
interface EmptyStateProps {
  emoji: string;
  title: string;
  sub?: string;
  cta?: string;         // button label
  onCtaPress?: () => void;
}
```

Centered column, `padding: 40 32`. Emoji 40px, title 16px extrabold, sub 14px textSub, CTA is secondary button.

### 9.4 SkeletonRow

Shimmer animation version of `PlanRow`. Shimmer: `withRepeat(withTiming(1, {duration:1200}), -1, true)` on opacity 0.4→1. Placeholder blocks use `colors.surfaceMid` as fill. Same height as `PlanRow`.

### 9.5 Toast

Imperative. Triggered by `useToast().show(message)`. Slides up from bottom (above nav bar), auto-dismisses after 2.5s.

Position: `bottom: layout.navBarHeight + 12`. Black bg, white text, `radii.lg`, shadow. `toastIn` animation: opacity 0→1 + translateY 10→0, 300ms.

### 9.6 Avatar

```typescript
interface AvatarProps {
  uri?: string;          // if undefined, shows initials fallback
  initials?: string;     // e.g. "AK" — shown when uri fails or is missing
  size: 28 | 32 | 40 | 48;
  shape?: 'circle' | 'rounded';  // circle = size/2 radius, rounded = radii.lg
  border?: boolean;              // 2px white border (for stacked avatars)
}
```

Use `expo-image` with `contentFit="cover"`. On error: show initials div, surface bg, textSub text. Initials are first letter of first + last name.

### 9.7 CostTag, TrustPill, SpotsBadge, LiveDot, ActivityIcon, Badge

Defined in Section 6 of v1 document. Implementations use tokens exclusively. No changes needed beyond switching to `react-native-reanimated` for LiveDot animation.

---

## 10. Molecule Specs

### 10.1 PlanRow

```typescript
interface PlanRowProps {
  plan: Plan;
  variant: 'nearby' | 'joined' | 'created' | 'history';
  onPress: (planId: string) => void;
}
```

**Fixed height: 72px** — required for `FlatList.getItemLayout`.

Left edge: 3px `colors.green` border + `colors.joinedRowBg` background when `variant === 'joined'`.

Layout: `flexDirection: row`, `alignItems: center`, `gap: 12`, `paddingHorizontal: spacing.screenPx`.

Contents (left to right): `ActivityIcon (40px)` → `PlanInfo (flex:1)` → `PlanRight (flexShrink:0)`.

PlanInfo: plan name (lg, extrabold, -0.02em letterSpacing, 1 line truncated) → location (sm, textSub) → `<PlanMeta />`.

PlanRight: `<Countdown />` top → `<Button variant="join*" />` bottom.

Android: `android_ripple={{ color: colors.surfaceMid }}` on the Pressable wrapper.

### 10.2 TabBar (in-screen)

Used inside Home (Nearby/Joined/Created), Profile (Hosted/Joined), and other-profile.

```typescript
interface TabBarProps {
  tabs: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}
```

Border-bottom: 1px `colors.border`. Each tab: flex:1, 36px height, centered label. Active: black text, 2px black bottom border. Inactive: textSub text.

### 10.3 EndorsementTag

```typescript
interface EndorsementTagProps {
  label: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}
```

Default: surface bg, border, textSub text. Active: black bg, white text. Count shown as small bold number to the right of label. Toggle animation: `withTiming`, 150ms.

### 10.4 GenderBadge

```typescript
interface GenderBadgeProps {
  pref: 'all' | 'women' | 'men';
}
// 'all' renders nothing
```

### 10.5 NotifRow

```typescript
interface NotifRowProps {
  notif: Notification;
  onPress: (notif: Notification) => void;
  onApprove?: (notifId: string) => void;   // only for type='join_request'
  onDecline?: (notifId: string) => void;   // only for type='join_request'
  onPostRecap?: (planId: string) => void;  // only for type='plan_ended'
}
```

Layout: `flexDirection: row`, `gap: 12`, `padding: 14 screenPx`, `alignItems: flex-start`, `borderBottom: 1px surface-mid`.

Unread state: bg `#FFFAF8` (light) / `#1A0E08` (dark). Unread dot: 8px coral circle, `alignSelf: flex-start`, `marginTop: 4`.

**Left slot — 42×42 circle:**
- If `actorAvatarUri` present: Avatar (42px, circle)
- If no avatar: surface bg circle with 1.5px border, icon centered (18px)
- In both cases: 18×18 type-icon badge at bottom-right, bg `colors.bg`, 1.5px border, `radii.full`

**Type icon + color map:**
| type | icon | color |
|---|---|---|
| `new_joiner` | `circle-check` | `colors.green` |
| `join_request` | `user-plus` | `colors.coral` |
| `request_approved` | `badge-check` | `colors.green` |
| `request_declined` | `x` | cost.sponsoredFg |
| `plan_ended` | `zap` | `colors.amber` |
| `new_recap` | `image` | `colors.textSub` |
| `new_follower` | `user` | `colors.textSub` |

**Right slot — flex:1:**
- Body text: 13px, weight 700 (unread) / 500 (read), `colors.text`, `lineHeight: 1.5`
- Plan label (if present): 11px, `colors.textSub`, `marginBottom: 6`
- Timestamp: 10px, `colors.textDim`

**Inline actions — rendered below timestamp, `marginTop: 8`:**

`join_request` + unread only:
```
[Approve]  [Decline]
```
- Approve: black bg, white text, `check` icon (11px), `padding: 6 12`, `radii.sm`, 11px bold. `event.stopPropagation()` on press.
- Decline: surface bg, textSub text + border, `x` icon (11px), same sizing.

`plan_ended` + unread only:
```
[📷 Post recap]
```
- cost.copayBg bg, amber text + icon, same sizing as above.

**Haptics:** `Light` on any inline action tap.

---

## 11. Organism Specs

### 11.1 NavBar

```typescript
interface NavBarProps {
  active: 'home' | 'recaps' | 'profile';  // map tab navigates, not a real tab
  badges?: { notifications?: number };
}
```

5 items: Home · Map · [Create button] · Recaps · Profile.

Create button: 48×48 coral square (`radii.lg`), `+` icon (24px, white, sw 2.5), shadow `rgba(255,77,46,0.35)`. Never gets active state. On press: opens `CreateSheet` as a modal + `Haptics.impactAsync(Heavy)`.

Nav icons: 24px. Active: `colors.black`. Inactive: `colors.textDim`. Label: 10px, 600 weight.

Height: `layout.navBarHeight` (72px). This is the footer slot — `Screen` adds `insets.bottom` on top.

### 11.2 PlanList

Implements a `FlatList` (not `ScrollView`) with:
```typescript
getItemLayout={(_data, index) => ({
  length: 72,        // PlanRow fixed height
  offset: 72 * index,
  index,
})}
keyExtractor={(item) => item.id}
```

Sections (NOW / LATER TODAY / THIS WEEK) are implemented as `FlatList` section headers, not a separate `SectionList`.

### 11.3 CreateSheet

Uses `@gorhom/bottom-sheet`. Snap points: `['92%']`. Backdrop opacity: 0.45.

Step 1: Category grid (8 cells, 2-column) + activity name text input.
Step 2: Location (FieldRow → opens loc-search screen) · When (picker) · Spots (stepper 2–10) · Cost type (4 options) · Who can join (gender picker) · Plan type (Open/Closed toggle) · Rules (optional TextInput).
Step 3: Preview card (exact replica of PlanRow) + Post button.

Step indicator: 3 dots at top, filled dot = current step.

Category selection in step 1 applies `CATEGORY_PRESETS` to step 2 defaults.

### 11.4 MapView

Uses `react-native-maps`. Tile style: light mode = standard map, dark mode = dark style.

Plan pins: `Pressable` containing a pill-shaped container (`radii.full`), 2.5px white border, shadow. Coral bg for NOW plans, black for others. Shows countdown label or time inside.

On pin press: bottom card slides up (translateY animation, 300ms spring). Card: `radii.xxl` top corners, plan row content + HOP ON button.

Blue dot: user location marker.

Floating search bar: absolute top, `margin: 12`, white bg, shadow.

---

## 12. Navigation (`src/navigation/`)

### Route param types (`navigation/types.ts`)

```typescript
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type OnboardingStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignupPhone: undefined;
  SignupOtp: { phone: string };
  SignupName: undefined;
  SignupDob: undefined;
  SignupGender: undefined;
  SignupPhoto: undefined;
  Interests: undefined;
  ContactsSync: undefined;
  PeopleToFollow: undefined;
  Neighbourhood: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  HomeEmpty: undefined;
  Search: undefined;
  Plan: { planId: string };
  PlanHost: { planId: string };
  PlanRequests: { planId: string };
  PlanEdit: { planId: string };
  PlanCancelConfirm: { planId: string };
  PlanLeaveConfirm: { planId: string };
  PlanExpired: { planId: string };
  PlanEnded: { planId: string };
  PlanPosted: { planId: string };
  PlanJoined: { planId: string };
  PlanRequested: { planId: string };
  PlanApproved: { planId: string };
  PlanDeclined: { planId: string };
  Endorse: { planId: string };
  LocSearch: { returnTo: string };
};

// ... similar for RecapsStack, ProfileStack
```

### Navigator rules

- Bottom tab bar is hidden (`tabBarStyle: { display: 'none' }`). `NavBar` is rendered as `Screen footer` on each tab root screen only.
- Stack screens (Plan, Profile, Settings, etc.) have no `NavBar` in footer.
- The Create tab does not navigate — it fires `openCreateSheet()`.
- `navigationRef` exported from `RootNavigator` for imperative navigation (toast deep links, notification taps).

### Chat activation rule

The chat CTA ("Open chat") on the plan detail screen is only accessible when **both** conditions are met:
1. The plan has ≥3 confirmed attendees
2. The plan starts within 2 hours (`minutesUntilStart ≤ 120`)

Before both conditions are met, the chat entry point is hidden entirely — do not render a disabled state. Once active, chat persists until the plan is ended or cancelled.

### Android back button

Every screen that needs custom back behaviour uses:
```typescript
import { useBackHandler } from '@/hooks/useBackHandler';
useBackHandler(() => {
  // return true to prevent default, false to allow
});
```

---

## 12b. Missing Screen Specs

### PlanRequested screen

Centered column layout (`scroll={false}`, `justifyContent: center`, `padding: 32 screenPx`, `textAlign: center`). No NavBar. Back button in header navigates to Home.

**Default state (no withdraw confirm):**

- Icon container: 72×72, `radii: 22`, `cost.copayBg` bg, `clock` icon (34px, `cost.copayFg`). FadeUp 0.4s.
- Heading: "Request sent" — 26px, weight 900, `colors.text`, letterSpacing -0.025em. FadeUp 0.4s delay 0.05s.
- Sub copy: "[Host first name] will review your request and let you know." — 14px, `colors.textSub`, lineHeight 1.7, maxWidth 260. FadeUp delay 0.1s.
- Plan pill: inline-flex row, `radii.full`, surface bg, 1px border. Contains: 22×22 activity icon (`radii.xs`, category bg/icon) + plan name (13px bold) + Countdown. FadeUp delay 0.12s.
- TrustGrid: shows current user's own trust stats (hosted, joined, attendanceScore, peopleMet). FadeUp delay 0.14s.
- Caveat: "[Host first name] can see your trust stats above." — 12px, `colors.textDim`. FadeUp delay 0.16s.
- Buttons (FadeUp delay 0.18s):
  - Primary secondary: "Back to home" → navigates to Home tab
  - Ghost link: "Withdraw request" (13px, weight 600, `colors.textDim`) → triggers withdraw confirm inline

**Withdraw confirm state (inline, replaces buttons):**

- Container: full width, `padding: 16`, `cost.sponsoredBg` bg, `radii.lg`. FadeUp 0.2s.
- Title: "Withdraw request?" — 14px, weight 700, `cost.sponsoredFg`.
- Body: "You'll lose your place in the queue. If the plan fills up you may not get another spot." — 12px, `cost.sponsoredFg`, lineHeight 1.5.
- Two buttons side by side (`gap: 8`, `flexDirection: row`):
  - "Yes, withdraw": `flex: 1`, `cost.sponsoredFg` bg, white text, `radii.sm`, 13px bold. On press: removes join request, shows toast "Request withdrawn", navigates to Home.
  - "Keep request": `flex: 1`, transparent bg, `cost.sponsoredFg` border + text, `radii.sm`, 13px bold. On press: returns to default state.

---

### PlanDeclined screen

Centered column layout (`scroll={false}`, `justifyContent: center`, `padding: 32 screenPx`, `textAlign: center`). No NavBar. No back button in header (back() navigates stack).

- Emoji container: 72×72, `radii: 22`, surface bg, 1.5px border. Contains 😔 at 36px.
- Heading: "Not this time." — 24px, weight 800, `colors.text`, letterSpacing -0.025em.
- Sub copy: "[Host first name] couldn't fit you in for **[plan name]**. Nothing personal — plans fill fast." — 14px, `colors.textSub`, lineHeight 1.7, maxWidth 260. Plan name bold in `colors.text`.
- Buttons:
  - Primary coral: "See other plans nearby" → navigates to Home tab (Nearby sub-tab).
  - Secondary: "Back" → `back()`.

No "nearby alternatives" list is rendered on this screen — the CTA navigates the user to Home directly.

---

### NotifRow inline actions — full interaction spec

See §10.5 for component spec. Interaction rules:

- Approve: calls `onApprove(notifId)`. Row immediately updates: inline actions disappear, body text changes to "[Name]'s request approved", unread dot cleared, bg returns to default. Toast: "Request approved".
- Decline: calls `onDecline(notifId)`. Same pattern. Toast: "Request declined".
- Post recap: calls `onPostRecap(planId)`. Navigates to `recap-post` screen with `planId` set.
- Tapping the row itself (outside inline buttons): `onPress(notif)`. Routes based on `notif.type`:

| type | destination |
|---|---|
| `new_joiner` | `PlanHost` |
| `join_request` | `PlanRequests` |
| `request_approved` | `Plan` |
| `request_declined` | `PlanDeclined` |
| `plan_ended` | `Endorse` |
| `new_recap` | `RecapDetail` |
| `new_follower` | `ProfileOther` |

Mark-all-read button: shown in header when unread count > 0. Coral text, 12px, weight 600. Unread count badge: coral pill, white text, 11px bold, `radii.full`.

---

### Block / unblock flow (`profile-other` screen)

**Header:** empty title, two icon buttons on right — `ban` (18px, `colors.textDim`) and `flag` (18px, `colors.textDim`).

**Follow / blocked button (below name in profile header):**

- Default (not blocked): `FollowButton` — see §10 for follow button spec.
- Blocked state: inline-flex row, `cost.sponsoredBg` bg, 1.5px `cost.sponsoredFg` border, `radii.sm`. Contains `ban` icon (12px, `cost.sponsoredFg`) + "Blocked · Unblock" text (12px, weight 700, `cost.sponsoredFg`). On press: calls `prUnblockUser()`, reverts to Follow button, shows toast "Unblocked".

**Block confirm sheet (rendered as absolute overlay, not a navigation):**

Triggered by pressing the `ban` icon in the header. State: `ui._blockConfirm = true`. Renders over the current screen without navigating.

- Backdrop: `position: absolute, inset: 0`, `rgba(0,0,0,0.5)` bg, `zIndex: 50`. FadeIn 0.2s.
- Sheet: bg `colors.bg`, `radii.xl` top corners, `padding: 24 screenPx 32`. SlideUp 0.28s `cubic-bezier(0.25,1,0.5,1)`.
- Handle bar: 36×4, `radii.full`, `colors.borderMid`, centered, `marginBottom: 20`.
- Avatar: 56×56 circle, centered, `marginBottom: 12`.
- Title: "Block [name]?" — 17px, weight 800, `colors.text`.
- Body: "They won't be able to see your plans or profile. You won't see theirs either." — 13px, `colors.textSub`, lineHeight 1.6, maxWidth 260, centered.
- Buttons (`flexDirection: column`, `gap: 8`):
  - "Block [name]": full width, `cost.sponsoredFg` bg, white text, `radii.xl`, `padding: 15`, 15px weight 800.
  - "Cancel": secondary button. On press: `ui._blockConfirm = false`, re-renders profile.

**On confirm block:** adds user to `session.blockedUsers`, `ui._blockConfirm = false`, stays on `profile-other` screen (no navigation). Follow button replaced with "Blocked · Unblock". Toast: "You won't see [first name]'s content".

**Unblock from settings:** `settings-blocked` screen lists blocked users as rows. Each row has an "Unblock" button (secondary, small). Unblocking from settings is functionally identical to unblocking from the profile.

---

### Story viewer (`recap-detail` in story mode)

Entered from: tapping any `StoryBubble` in the `StoryStrip`. Sets `ui.storyMode = true` and `selected.momentId`.

**Layout:** full-screen, bg `#000`, `overflow: hidden`, `position: relative`. `scroll={false}`. No NavBar, no header slot.

**Layers (bottom to top):**

1. Full-bleed image: `position: absolute, inset: 0`, `contentFit: cover`.
2. Top gradient overlay: `position: absolute`, top 0, height 120, `linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)`, `zIndex: 1`.
3. Bottom gradient overlay: `position: absolute`, bottom 0, height 200, `linear-gradient(to top, rgba(0,0,0,0.75), transparent)`, `zIndex: 1`.
4. Tap zones: `position: absolute, inset: 0`, `flexDirection: row`, `zIndex: 5`. Left half → previous story. Right half → next story. See interaction rules below.
5. Progress bars: `position: absolute`, top 12, left 12, right 12, `zIndex: 10`. `flexDirection: row`, `gap: 4`. Each segment: `flex: 1`, 2px height, `radii: 1`.
   - Completed segments: `#fff`
   - Active segment: `rgba(255,255,255,0.9)` track + white fill animated with `withTiming(1, { duration: 5000 })` on width 0→100%. On complete → advance to next story.
   - Upcoming segments: `rgba(255,255,255,0.3)`
6. Top bar: `position: absolute`, top 22, left 12, right 12, `zIndex: 10`. `flexDirection: row`, `alignItems: center`, `gap: 10`.
   - Author avatar: 34×34 circle, 1.5px `rgba(255,255,255,0.6)` border.
   - Name: 13px, weight 700, `#fff`.
   - Timestamp + location: 10px, `rgba(255,255,255,0.6)`.
   - Close button: 32×32 circle, `rgba(0,0,0,0.3)` bg, `x` icon (16px white, sw 2). On press → close story viewer, return to Recaps tab.
7. Bottom bar: `position: absolute`, bottom 0, left 0, right 0, `zIndex: 10`, `padding: 16 screenPx 32`.
   - Plan pill (if recap has planId): `rgba(255,255,255,0.15)` bg, `backdrop-filter: blur(8px)`, `radii.full`, `padding: 4 10`. `map-pin` icon (10px white) + plan name (11px, weight 600, white). `marginBottom: 8`.
   - Caption: 14px, `#fff`, lineHeight 1.6, `marginBottom: 14`.
   - Actions row: `gap: 16`. Heart (22px, coral if liked / white if not) + like count. Comment bubble (22px white) + comment count → closes story, navigates to `RecapComments`. Share icon (22px white, `marginLeft: auto`).

**Tap zone interaction rules:**
- Tap left half: if `currentIndex > 0` → go to previous story. If `currentIndex === 0` → close viewer.
- Tap right half: if next story exists → advance. If last story → close viewer.
- Story advance: `selected.momentId` updates, progress bar resets and re-animates from 0.
- Mark story as seen: `recap.isSeen = true` on any story that becomes the active story. Story bubble ring changes from coral to grey.

**Animation:** Screen entry — no transition (full-screen takeover is instant). Exit — no transition.

---

## 13. Shared Hooks (`src/hooks/`)

### `useCountdown.ts`

```typescript
// Ticks every second. Returns minutesUntilStart (can be negative).
export function useCountdown(startsAt: string): number {
  const [mins, setMins] = useState(() => diffMins(startsAt));
  useEffect(() => {
    const id = setInterval(() => setMins(diffMins(startsAt)), 1000);
    return () => clearInterval(id);
  }, [startsAt]);
  return mins;
}
```

### `usePlanStatus.ts`

```typescript
// Derives urgency tier from minutesUntilStart
export function usePlanStatus(mins: number): 'now' | 'soon' | 'later' | 'expired' {
  if (mins < 0) return 'expired';
  if (mins <= 30) return 'now';
  if (mins <= 60) return 'soon';
  return 'later';
}
```

### `useToast.ts`

```typescript
// Imperative toast — call show() from anywhere
export function useToast() {
  return { show: (message: string) => toastEmitter.emit(message) };
}
```

### `useBackHandler.ts`

```typescript
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useBackHandler(handler: () => boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);
}
```

---

## 14. Shared Utils (`src/utils/`)

### `time.ts`

```typescript
export function diffMins(isoTimestamp: string): number  // ISO → minutes from now
export function timeAgo(isoTimestamp: string): string    // "2h ago", "just now"
export function formatDate(isoTimestamp: string): string // "Tue 7 PM", "Today 3 PM"
export function countdownLabel(mins: number): string     // "8m", "2h", "NOW"
```

### `plan.ts`

```typescript
export function deriveUrgency(mins: number): 'now' | 'soon' | 'later'
// now ≤ 30 min, soon ≤ 60 min, later > 60 min
export function getCostLabel(type: CostType, note?: string): string
export function getGenderLabel(pref: GenderPref): string
export function getSpotsVariant(remaining: number): 'normal' | 'critical' | 'full'
```

### `avatar.ts`

```typescript
export function getInitials(name: string): string   // "Priya Kumar" → "PK"
export function getAvatarPlaceholder(name: string): string  // initials-based placeholder URI
```

---

## 15. Types (`src/types/`)

Types must match the real API shape. Mocks satisfy these types. When backend is connected, only mock imports change — no type changes.

```typescript
// types/plan.ts
export type CostType     = 'free' | 'copay' | 'sponsored' | 'seeking';
export type GenderPref   = 'all' | 'women' | 'men';
export type PlanType     = 'open' | 'closed';
export type PlanStatus   = 'active' | 'full' | 'cancelled' | 'expired' | 'ended';
export type UrgencyTier  = 'now' | 'soon' | 'later';
export type MemberStatus = 'joined' | 'requested' | 'approved' | 'declined' | 'attended';

export interface Plan {
  id: string;
  activity: string;
  categoryId: string;
  location: string;
  lat: number;
  lng: number;
  startsAt: string;           // ISO timestamp
  minutesUntilStart: number;  // derived client-side, updated every minute
  capacity: number;
  spotsRemaining: number;
  type: PlanType;
  status: PlanStatus;
  cost: CostType;
  costNote?: string;
  genderPref: GenderPref;
  hostId: string;
  joinerIds: string[];
  description?: string;
  rules?: string;
  isMine?: boolean;
}

// types/user.ts
export interface User {
  id: string;
  name: string;
  handle: string;
  avatarUri?: string;
  neighbourhood: string;
  attendanceScore: number | null;    // 0–100, null = no plans attended yet
  isVerified: boolean;
  bio?: string;
  interests: string[];
  socialLinks?: {
    instagram?: string;
    linkedin?: string;
    facebook?: string;
  };
  plansHosted: number;
  plansAttended: number;
  peopleMet: number;
  familiarFaceIds: string[];
  endorsements: { label: string; count: number }[];
  profileVisibility: 'everyone' | 'followers' | 'nobody';
  planVisibility: 'everyone' | 'followers';
}

// types/notification.ts
export type NotifType =
  | 'new_joiner' | 'join_request' | 'request_approved' | 'request_declined'
  | 'plan_ended' | 'new_recap' | 'new_follower';

export interface Notification {
  id: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
  planId?: string;
  userId?: string;
  actorName?: string;        // denormalised display name — avoids lookup per row
  actorAvatarUri?: string;   // denormalised avatar — avoids lookup per row
  body: string;
}

// types/chat.ts
export interface Message {
  id: string;
  planId: string;
  authorId: string;
  authorName: string;         // denormalised
  authorAvatarUri?: string;   // denormalised
  isHost: boolean;            // renders "Host" label in chat bubble
  body: string;
  createdAt: string;
}

export interface Chat {
  planId: string;
  isActive: boolean;          // true when 3+ attendees AND T-2h
  messages: Message[];
}

// types/recap.ts
export interface Recap {
  id: string;
  planId: string;
  authorId: string;
  imageUri: string;    // 4:5 crop enforced
  caption?: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isSeen?: boolean;    // for story strip ring state
}
```

---

## 16. Mock Data (`src/mocks/`)

Seed data mirrors the HTML prototype exactly. All mocks satisfy types from `src/types/`.

**Seed users:** 5 users (av1–av5 from Unsplash, same URLs as prototype).
**Seed plans:** 11 plans covering all urgency tiers, cost types, plan types, and states (active, full, expired, ended).
**Seed notifications:** 7 covering all notification types.
**Seed recaps:** 5 with mix of seen/unseen.
**Familiar faces:** av1 and av3 are familiar to the current user.

---

## 17. Animation Reference (Reanimated 2)

All animations use `react-native-reanimated`. `useNativeDriver` is implicit in Reanimated 2.

| Animation | Hook | Spec |
|---|---|---|
| Button press | `useSharedValue` + `withSpring` | scale 0.97, damping 15, stiffness 400 |
| Joiner avatar spring-in | `withSpring` | scale 0→1.18→0.94→1, 400ms, overshoot |
| Countdown digit change | `withTiming` | opacity 0.3→1 + translateY -3→0, 120ms |
| LiveDot ripple | `withRepeat(withTiming)` | scale 1→2.4 + opacity 1→0, 1.4s, loop |
| NOW pill pulse | `withRepeat(withSequence)` | opacity 1→0.5, scale 1→0.8, 1.5s loop |
| Sheet entry | `withTiming` | translateY 100%→0, 280ms, easing.out |
| Map card slide up | `withSpring` | translateY 100%→0, 300ms, spring |
| Toast slide up | `withTiming` | translateY 10→0 + opacity 0→1, 300ms |
| Tab press | `withSpring` | scale 0.92→1, fast |
| FadeUp (screen content) | `withTiming` | opacity 0→1 + translateY 8→0, 250ms |

---

## 18. Status Bar per Screen

Use `expo-status-bar`. Set per screen, not globally.

```typescript
import { StatusBar } from 'expo-status-bar';

// Light content (white icons) — on dark/coral backgrounds:
// splash, plan-posted, plan-joined, plan-approved
<StatusBar style="light" />

// Dark content (black icons) — all other screens:
<StatusBar style="dark" />

// Auto — respects system dark mode:
<StatusBar style="auto" />    // use this on all standard screens
```

---

## 19. Android-Specific Requirements

| Requirement | Implementation |
|---|---|
| Ripple on list rows | `android_ripple={{ color: colors.surfaceMid }}` on every `Pressable` row |
| Adaptive icon | `assets/adaptive-icon.png`, bg `#FF4D2E` in `app.json` |
| Back button | `useBackHandler` on all screens that intercept back (sheets, multi-step flows) |
| Status bar overlap | Handled by `Screen` via `useSafeAreaInsets` — no manual fixes |
| Splash screen | `expo-splash-screen`, hidden after fonts + mock data load |
| Edge-to-edge | `android.adaptiveIcon` set, `userInterfaceStyle: automatic` |

---

## 20. Accessibility Baseline

Minimum requirements for APK testing. Full WCAG compliance is post-launch.

```typescript
// Every interactive element:
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Join badminton plan at Play Arena"   // descriptive, not "join"
  accessibilityHint="Double tap to join this plan"
  style={...}
>

// Minimum tap target: 44×44px on everything
// If visual size < 44px, add hitSlop:
hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

// Images:
<Image accessibilityLabel="Priya's profile photo" ... />

// Icons used as buttons:
<Pressable accessibilityRole="button" accessibilityLabel="Go back">
  <Icon name="chevron-left" />
</Pressable>
```

---

## 21. Image Handling

```typescript
// Always use expo-image:
import { Image } from 'expo-image';

// Standard usage:
<Image
  source={{ uri: user.avatarUri }}
  style={{ width: 40, height: 40, borderRadius: radii.md }}
  contentFit="cover"
  placeholder={{ thumbhash: '...' }}   // optional blur placeholder
  transition={200}
/>

// 4:5 recap images (width × 1.25 = height):
<Image
  source={{ uri: recap.imageUri }}
  style={{ width: '100%', aspectRatio: 4/5 }}
  contentFit="cover"
/>
```

Avatar fallback: when `uri` is undefined or fails, render initials via `getInitials(user.name)` in a `View` with surface bg.

---

## 22. Font Loading (`App.tsx`)

```typescript
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium,
         Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
         Inter_900Black } from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular':   Inter_400Regular,
    'Inter-Medium':    Inter_500Medium,
    'Inter-SemiBold':  Inter_600SemiBold,
    'Inter-Bold':      Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
    'Inter-Black':     Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <KeyboardProvider>
            <RootNavigator />
            <ToastContainer />
          </KeyboardProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Font usage in StyleSheet:
```typescript
fontFamily: 'Inter-ExtraBold',   // for fontWeights.extrabold
fontFamily: 'Inter-Bold',        // for fontWeights.bold
// etc.
```

---

## 23. Screen Build Order

Complete each group fully (all screens render, dark mode works, navigation between them works) before starting the next. Build the APK after groups 1, 3, and 5.

### Group 0 — Foundation (before any screen)
1. `tokens.ts` — full token file
2. `ThemeContext.tsx` — full implementation
3. `Screen.tsx` — layout primitive
4. All fonts loading in `App.tsx`
5. Navigation skeleton (empty screens, correct stack structure)
6. All atoms
7. `PlanRow` molecule
8. `NavBar` organism
9. Mock data satisfying all types

**APK Build 0** — blank screens with correct navigation, fonts, and NavBar. Verify safe areas on a real Android device before proceeding.

### Group 1 — Onboarding (12 screens)
splash → login → signup-phone → signup-otp → signup-name → signup-dob → signup-gender → signup-photo → interests → contacts-sync → people-to-follow → neighbourhood

### Group 2 — Core Loop (6 screens)
home → plan → plan-host → plan-joined → plan-requested → endorse

**APK Build 1** — walkthrough the full join flow on device.

### Group 3 — Home Extended (4 screens)
home-empty → home-map → search → create (CreateSheet)

### Group 4 — Plan Lifecycle (9 screens)
plan-requests → plan-cancel-confirm → plan-leave-confirm → plan-edit → plan-expired → plan-ended → plan-posted → plan-approved → plan-declined

**APK Build 2** — full plan lifecycle testable. Share with first testers.

### Group 5 — Recaps (5 screens)
recaps → recap-post → recap-posted → recap-detail → recap-comments

### Group 6 — Profile (7 screens)
profile → profile-other → profile-new → profile-incomplete → profile-edit → follow-list → familiar-faces

### Group 7 — Notifications + Chat (2 screens)
notifications → chat

### Group 8 — Settings + Safety (12 screens)
settings → settings-neighbourhood → settings-notifications → settings-privacy → settings-blocked → settings-delete → terms → guidelines → report-user → report-plan → report-problem → loc-search

**APK Build 3** — full app. Beta test.

---

## 24. What Claude Code Must Never Do

| Never | Use instead |
|---|---|
| Write a hex color value outside `tokens.ts` | `useTheme().colors.*` |
| Use `TouchableOpacity` or `TouchableHighlight` | `Pressable` from `react-native-gesture-handler` |
| Use RN's built-in `Animated` API | `react-native-reanimated` |
| Use RN's built-in `Image` | `expo-image` |
| Use `ScrollView` for a list of plans, notifications, or recaps | `FlatList` with `keyExtractor` and `getItemLayout` |
| Use fixed `height: Npx` on content containers | `minHeight` or natural height |
| Add `paddingTop` for status bar in a screen file | `Screen` handles via `insets.top` |
| Add `paddingBottom: 72` for nav bar in a screen file | `Screen footer` slot handles it |
| Use `position: 'absolute', bottom: 0` for CTA buttons | `Screen footer` slot |
| Add `KeyboardAvoidingView` in a screen | `Screen keyboardAware={true}` |
| Import hex colors or raw values in a component | import from `@/theme/tokens` |
| Import an atom inside another atom | Molecules do composition, not atoms |
| Create a screen that does not use `Screen.tsx` | All 56 screens use Screen — no exceptions |
| Hardcode `20` for horizontal padding | `spacing.screenPx` |
| Import lucide icons directly in a component | `<Icon name="..." />` from `@/components/atoms/Icon` |
| Add a `useCountdown` or time calculation inline in a screen | `useCountdown` hook from `@/hooks` |
| Define a TypeScript interface that duplicates one in `src/types/` | Import from `@/types` |
| Use `Dimensions.get('window')` for layout | `flex: 1` on containers; `useSafeAreaInsets()` for inset values |
| Hardcode `375`, `812`, `844`, `390` or any device pixel dimension | Dimensions vary — never hardcode |
| Hardcode `44` for status bar height or `34` for home indicator | `insets.top` / `insets.bottom` from `useSafeAreaInsets()` |
| Reference `layout.phoneWidth`, `layout.phoneHeight`, `layout.usableHeight`, `layout.statusBarHeight`, `layout.homeIndicator` | These constants no longer exist — they were device-specific and wrong |

---

## 25. Pre-APK Checklist

Run before every build:

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] Every screen uses `<Screen />` as root
- [ ] No screen has content cut off at top or bottom on a real Android device
- [ ] No screen has content overlapping the status bar / notch / Dynamic Island
- [ ] No screen has content hiding behind the home indicator or nav bar
- [ ] No fixed `height: Npx` on any content container — `minHeight` or natural height only
- [ ] Every `flexDirection: row` has explicit `alignItems` set
- [ ] Every long text field has `numberOfLines={1}` + `ellipsizeMode="tail"` or intentional wrapping
- [ ] Every `FlatList` has `contentContainerStyle` with correct bottom padding
- [ ] No `ScrollView` used for lists of plans / notifications / recaps
- [ ] No absolute-positioned element near top/bottom edges without inset accounting
- [ ] All card/avatar containers with `borderRadius` also have `overflow: hidden`
- [ ] All shadows use token values (`shadow.sm/md/lg`) — no raw `shadow*` props
- [ ] No hardcoded device pixel dimensions (`375`, `812`, `844`, `390`, `44`, `34`) anywhere in source
- [ ] No `Dimensions.get('window')` calls used for layout
- [ ] No hardcoded hex colors outside `tokens.ts`
- [ ] Dark mode toggle works on every completed screen
- [ ] All buttons have press animation and haptic feedback
- [ ] All list screens use `FlatList`, not `ScrollView`
- [ ] Empty states render correctly on every list screen
- [ ] `accessibilityLabel` on every interactive element
- [ ] Minimum 44×44px tap targets (use `hitSlop` if needed)
- [ ] Status bar style correct on every screen
- [ ] Android back button works correctly on every screen
- [ ] No console errors or warnings
- [ ] Splash screen hides correctly after font load

---

## 26. Reference Files

| File | Purpose |
|---|---|
| `hopon-v4.html` | Visual reference for every component and screen. All visual decisions are final. |
| `hopon-prd.docx` | Feature specs, copy, trust system rules, success metrics. |

Conflict resolution: HTML prototype wins for visual decisions. PRD wins for behaviour and logic.
