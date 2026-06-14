/**
 * Named text style presets that compose design token values into complete
 * typography objects. This is Layer 2 of the design system.
 *
 * This file is intentionally framework-agnostic (no React imports). Components
 * that need raw style objects (inputs, legacy atoms using StyleSheet.create)
 * can import from here without pulling in the T.* React component tree.
 *
 * To add a new text style:
 * 1. Add the preset here
 * 2. Add the corresponding T.* export to T.tsx
 * Both steps are always required together — a preset with no T.* wrapper is
 * inaccessible to screens; a T.* wrapper with no preset breaks the separation.
 *
 * See docs/DESIGN_SYSTEM.md for the full typography guide.
 */
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from './tokens';

export const textStyles = {
  // Screen-level page titles (Profile, Settings headers)
  pageTitle: {
    fontFamily: fontFamilies.extrabold,
    fontSize: fontSizes.xl,
    letterSpacing: letterSpacing.heading * fontSizes.xl,
  },

  // Modal / confirm screen headings
  heading: {
    fontFamily: fontFamilies.extrabold,
    fontSize: fontSizes.xxl,
    letterSpacing: letterSpacing.heading * fontSizes.xxl,
  },

  // Card headers, section headings
  subheading: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.xl,
    letterSpacing: letterSpacing.heading * fontSizes.xl,
  },

  // Primary body copy (bios, descriptions, confirm subs)
  bodyLg: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
  },

  // Secondary body copy
  bodyMd: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.md,
    lineHeight: fontSizes.md * lineHeights.body,
  },

  // Row/list item title
  labelLg: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.body,
  },

  // Standard label
  labelMd: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.base,
  },

  // Small labels, tags, endorsements
  labelSm: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.sm,
  },

  // Extra-small labels
  labelXs: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.xs,
  },

  // ALL-CAPS section headers (e.g. "FAMILIAR FACES", "ENDORSEMENTS")
  capsLg: {
    fontFamily: fontFamilies.extrabold,
    fontSize: fontSizes.base,
    letterSpacing: letterSpacing.sectionHeader * fontSizes.base,
    textTransform: 'uppercase' as const,
  },

  // Smaller ALL-CAPS labels
  capsSm: {
    fontFamily: fontFamilies.extrabold,
    fontSize: fontSizes.xs,
    letterSpacing: letterSpacing.sectionHeader * fontSizes.xs,
    textTransform: 'uppercase' as const,
  },

  // Handle, neighbourhood, date, count secondary text
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.sm,
  },

  // Tiny meta — dim counts, icon labels
  metaXs: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.xs,
  },

  // Follower/following counts
  statNum: {
    fontFamily: fontFamilies.extrabold,
    fontSize: fontSizes.lg,
  },

  // SemiBold variant for inputs, names
  semibold: {
    fontFamily: fontFamilies.semibold,
    fontSize: fontSizes.body,
  },

  // Celebration / state screen large display title
  display: {
    fontFamily: fontFamilies.black,
    fontSize: fontSizes.xxxl,
    letterSpacing: -0.025 * fontSizes.xxxl,
  },

  // Inline bold span (inherits size from parent)
  bold: {
    fontFamily: fontFamilies.bold,
  },
} as const;
