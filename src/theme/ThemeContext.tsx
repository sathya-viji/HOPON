/**
 * Theme context — the adaptive layer of the design system.
 *
 * Responsibilities:
 * - Resolves light/dark mode-conditional color tokens into a single `colors` object
 * - Follows the system color scheme by default; exposes `setMode` / `toggleMode`
 *   for a future manual override (e.g. in-app dark mode toggle in Settings)
 * - Provides `useTheme()` as the only public API — components never call
 *   useColorScheme() or check the mode themselves
 *
 * Color mapping strategy:
 * - Neutral surface/text colors come from colors.light.* or colors.dark.*
 * - Semantic groups (cost, gender, joinBtn) have distinct dark variants because
 *   the prototype design specifies different hues in dark mode, not just inverted
 *   lightness. Do not substitute cost.free* for joinBtnJoined* — they differ.
 * - ctaBg/ctaFg is the adaptive primary CTA: black/white in light, text/bg in dark
 *
 * See docs/DESIGN_SYSTEM.md for the full color usage guide.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
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
  coral: string;
  black: string;
  green: string;
  amber: string;
  white: string;
  // Adaptive CTA — prototype: light=black/white, dark=text/bg
  ctaBg: string;
  ctaFg: string;
  cost: {
    freeBg: string;
    freeFg: string;
    freeBorder: string;
    copayBg: string;
    copayFg: string;
    copayBorder: string;
    sponsoredBg: string;
    sponsoredFg: string;
    sponsoredBorder: string;
    seekingBg: string;
    seekingFg: string;
    seekingBorder: string;
  };
  gender: typeof colorTokens.gender;
  joinedRowBg: string;
  unreadRowBg: string;
  // Dark-mode join button overrides per prototype
  joinBtnJoinedBg: string;
  joinBtnJoinedFg: string;
  joinBtnJoinedBorder: string;
  joinBtnMineBg: string;
  joinBtnMineFg: string;
  joinBtnMineBorder: string;
  profileCardBg: string;
  profileCardBorder: string;
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

  useEffect(() => {
    setMode(systemScheme === 'dark' ? 'dark' : 'light');
  }, [systemScheme]);

  const isDark = mode === 'dark';
  const neutral = isDark ? colorTokens.dark : colorTokens.light;

  const colors: ThemeColors = {
    ...neutral,
    coral: colorTokens.coral,
    black: colorTokens.black,
    green: colorTokens.green,
    amber: colorTokens.amber,
    white: colorTokens.white,
    ctaBg: isDark ? colorTokens.dark.text : colorTokens.black,
    ctaFg: isDark ? colorTokens.dark.bg : colorTokens.white,
    cost: isDark
      ? {
          freeBg: colorTokens.cost.darkFreeBg,
          freeFg: colorTokens.cost.darkFreeFg,
          freeBorder: colorTokens.cost.darkFreeBorder,
          copayBg: colorTokens.cost.darkCopayBg,
          copayFg: colorTokens.cost.darkCopayFg,
          copayBorder: colorTokens.cost.darkCopayBorder,
          sponsoredBg: colorTokens.cost.darkSponsoredBg,
          sponsoredFg: colorTokens.cost.darkSponsoredFg,
          sponsoredBorder: colorTokens.cost.darkSponsoredBorder,
          seekingBg: colorTokens.cost.darkSeekingBg,
          seekingFg: colorTokens.cost.darkSeekingFg,
          seekingBorder: colorTokens.cost.darkSeekingBorder,
        }
      : {
          freeBg: colorTokens.cost.freeBg,
          freeFg: colorTokens.cost.freeFg,
          freeBorder: colorTokens.cost.freeBorder,
          copayBg: colorTokens.cost.copayBg,
          copayFg: colorTokens.cost.copayFg,
          copayBorder: colorTokens.cost.copayBorder,
          sponsoredBg: colorTokens.cost.sponsoredBg,
          sponsoredFg: colorTokens.cost.sponsoredFg,
          sponsoredBorder: colorTokens.cost.sponsoredBorder,
          seekingBg: colorTokens.cost.seekingBg,
          seekingFg: colorTokens.cost.seekingFg,
          seekingBorder: colorTokens.cost.seekingBorder,
        },
    gender: colorTokens.gender,
    joinedRowBg: isDark ? colorTokens.joinedRowBgDark : colorTokens.joinedRowBg,
    unreadRowBg: isDark ? colorTokens.unreadRowBgDark : colorTokens.unreadRowBg,
    joinBtnJoinedBg: isDark ? '#062B1D' : colorTokens.cost.freeBg,
    joinBtnJoinedFg: isDark ? '#34D399' : colorTokens.cost.freeFg,
    joinBtnJoinedBorder: isDark ? '#0A3D28' : '#A0E8D0',
    joinBtnMineBg: isDark ? '#1A1000' : colorTokens.cost.copayBg,
    joinBtnMineFg: isDark ? '#E8A000' : colorTokens.cost.copayFg,
    joinBtnMineBorder: isDark ? '#2A1F00' : '#F0D890',
    profileCardBg: isDark ? colorTokens.profileCardBgDark : colorTokens.light.surface,
    profileCardBorder: isDark ? colorTokens.profileCardBorderDark : colorTokens.light.border,
  };

  return (
    <ThemeContext.Provider
      value={{
        colors,
        mode,
        setMode,
        toggleMode: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
