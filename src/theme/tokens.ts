/**
 * Design token primitives — the single source of truth for every numeric and
 * color value in the app. Nothing in components or screens should contain a
 * hardcoded number or hex string that corresponds to a token here.
 *
 * Extending this file:
 * - Add to the correct export (spacing, radii, colors, etc.)
 * - Name tokens for their role, not their value ("cardGap" not "twelve")
 * - After adding a color token, update ThemeContext if it needs dark-mode variants
 *
 * See docs/DESIGN_SYSTEM.md for the full token usage guide.
 */

export const colors = {
  // Global brand constants — these do not change between light and dark mode.
  // Use them directly only when a fixed color is intentional (e.g. the coral CTA
  // button is always coral). For adaptive UI, use colors.* from useTheme() instead.
  coral: '#FF4D2E',
  black: '#0A0A0A',
  green: '#00A878',
  amber: '#C47800',

  light: {
    bg: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceMid: '#F0F0F0',
    border: '#EBEBEB',
    borderMid: '#D0D0D0',
    text: '#0A0A0A',
    textSub: '#888888',
    textDim: '#BBBBBB',
    textGhost: '#DDDDDD',
  },

  dark: {
    bg: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceMid: '#222222',
    border: '#2A2A2A',
    borderMid: '#3A3A3A',
    text: '#F0F0F0',
    textSub: '#909090',
    textDim: '#3A3A3A',
    textGhost: '#2A2A2A',
  },

  profileCardBgDark: '#160E0C',
  profileCardBorderDark: '#2A1814',

  cost: {
    freeBg: '#DCFFF4',
    freeFg: '#006644',
    freeBorder: '#A0E8D0',
    copayBg: '#FFF4DC',
    copayFg: '#7A4F00',
    copayBorder: '#F0D080',
    sponsoredBg: '#FFE8E4',
    sponsoredFg: '#B02000',
    sponsoredBorder: '#F0A898',
    seekingBg: '#F0F0F0',
    seekingFg: '#555555',
    seekingBorder: '#C8C8C8',
    darkFreeBg: '#0A2318',
    darkFreeFg: '#34D399',
    darkFreeBorder: '#1A4A30',
    darkCopayBg: '#241A00',
    darkCopayFg: '#F5C842',
    darkCopayBorder: '#4A3800',
    darkSponsoredBg: '#2A0A06',
    darkSponsoredFg: '#F87171',
    darkSponsoredBorder: '#5A1A10',
    darkSeekingBg: '#1C1C1C',
    darkSeekingFg: '#999999',
    darkSeekingBorder: '#3A3A3A',
  },

  gender: {
    womenBg: '#FCE4EC',
    womenFg: '#C2185B',
    menBg: '#E3F2FD',
    menFg: '#1565C0',
  },

  joinedRowBg: '#F8FFFC',
  joinedRowBgDark: '#071A11',
  unreadRowBg: '#FFFAF8',
  unreadRowBgDark: '#1A0E08',

  white: '#FFFFFF',
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  xxl: 24,
  full: 999,
} as const;

export const spacing = {
  screenPx: 20,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const layout = {
  navBarHeight: 72,
  minTapTarget: 44,
} as const;

export const fontSizes = {
  xxs: 9,
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  body: 14,
  lg: 15,
  xl: 18,
  xxl: 22,
  xxxl: 26,
} as const;

export const fontWeights = {
  regular: '400' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
} as const;

export const fontFamilies = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold',
  black: 'Inter-Black',
} as const;

export const letterSpacing = {
  heading: -0.02,
  sectionHeader: 0.12,
  tags: 0.08,
  cta: 0.04,
  meta: 0.02,
} as const;

export const lineHeights = {
  tight: 1.3,
  body: 1.7,
  relaxed: 2.0,
} as const;

export const borderWidths = {
  hairline: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2,
} as const;

export const iconSizes = {
  xxs: 10,
  xs: 12,
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 36,
} as const;

export const avatarSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  xxl: 80,
} as const;

export const HIT_SLOP = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  coral: {
    shadowColor: '#FF4D2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// Plan category definitions. Each category carries its own icon, light bg/fg, and dark bg/fg.
// Components should use cat.bg / cat.iconColor (light) or cat.darkBg / cat.darkIconColor (dark)
// by reading the current mode from useTheme() rather than hardcoding one variant.
export const CATEGORIES = [
  { id: 'sports',        label: 'Sports & fitness', icon: 'dumbbell',     bg: '#E8F5E9', darkBg: '#0A1F0C', iconColor: '#2E7D32', darkIconColor: '#4CAF6A' },
  { id: 'food',          label: 'Food & drinks',    icon: 'utensils',     bg: '#FFF4DC', darkBg: '#1F1500', iconColor: '#B8860B', darkIconColor: '#E8A800' },
  { id: 'entertainment', label: 'Entertainment',    icon: 'clapperboard', bg: '#EEF2FF', darkBg: '#0E0A1F', iconColor: '#4527A0', darkIconColor: '#9575CD' },
  { id: 'outdoors',      label: 'Outdoors',         icon: 'trees',        bg: '#F0FFF4', darkBg: '#081A0C', iconColor: '#1B5E20', darkIconColor: '#43A85A' },
  { id: 'learning',      label: 'Learning',         icon: 'book-open',    bg: '#F0F8FF', darkBg: '#081018', iconColor: '#01579B', darkIconColor: '#4D9FE8' },
  { id: 'social',        label: 'Social',           icon: 'users',        bg: '#FFF5F3', darkBg: '#1A0810', iconColor: '#880E4F', darkIconColor: '#E040A0' },
  { id: 'arts',          label: 'Arts & culture',   icon: 'palette',      bg: '#FFF8E1', darkBg: '#1A0E00', iconColor: '#E65100', darkIconColor: '#FF7F3E' },
  { id: 'other',         label: 'Other',            icon: 'sparkles',     bg: '#F5F5F5', darkBg: '#181818', iconColor: '#555555', darkIconColor: '#999999' },
] as const;

export const CATEGORY_PRESETS: Record<string, { when: string; spots: number; cost: string }> = {
  sports: { when: '1hr', spots: 4, cost: 'free' },
  food: { when: 'now', spots: 4, cost: 'free' },
  entertainment: { when: 'tonight', spots: 3, cost: 'copay' },
  outdoors: { when: '30min', spots: 5, cost: 'free' },
  learning: { when: '1hr', spots: 3, cost: 'free' },
  social: { when: 'tonight', spots: 6, cost: 'free' },
  arts: { when: 'tonight', spots: 4, cost: 'free' },
  other: { when: 'now', spots: 3, cost: 'free' },
};
