/**
 * Typography API — Layer 3 of the design system.
 *
 * All text rendered in screen files must go through one of these components.
 * Direct <Text style={{...}}> in screens is not permitted.
 *
 * Usage pattern:
 *   import * as T from '@/components/atoms/T';
 *   <T.LabelLg>Plan title</T.LabelLg>
 *   <T.BodyLg><T.Bold>{name}</T.Bold> joined the plan.</T.BodyLg>
 *
 * Each component wraps a textStyles preset from textStyles.ts and applies
 * a sensible default color from the theme. Override color via the `color` prop,
 * not via style.color, to keep color intent explicit.
 *
 * T.Bold is special: it carries no font size — it inherits size from a parent
 * <Text> via React Native's nested text inheritance. Use it only inside another
 * T.* component for inline emphasis.
 *
 * To add a new variant: add a preset to textStyles.ts first, then add the
 * corresponding export here. See docs/DESIGN_SYSTEM.md for the full guide.
 */
import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';

interface TProps {
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
  onPress?: () => void;
}

// Cap Dynamic Type scaling so large accessibility text sizes don't clip out of
// the app's many fixed-height controls (pills, inline buttons, rows), while still
// allowing meaningful enlargement for low-vision users.
const TEXT_MAX_SCALE = 1.4;

export function PageTitle({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.pageTitle, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function Heading({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.heading, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function Subheading({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.subheading, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function BodyLg({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.bodyLg, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function BodyMd({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.bodyMd, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function LabelLg({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.labelLg, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function LabelMd({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.labelMd, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function LabelSm({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.labelSm, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function LabelXs({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.labelXs, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function CapsLg({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.capsLg, { color: color ?? colors.textSub }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function CapsSm({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.capsSm, { color: color ?? colors.textSub }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function Meta({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.meta, { color: color ?? colors.textSub }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function MetaXs({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.metaXs, { color: color ?? colors.textDim }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function StatNum({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.statNum, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function Semibold({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.semibold, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

export function Display({ color, style, numberOfLines, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.display, { color: color ?? colors.text }, style]} numberOfLines={numberOfLines} onPress={onPress} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
      {children}
    </Text>
  );
}

// Inline bold span — use INSIDE another <Text> for inline emphasis
export function Bold({ color, style, children, onPress }: TProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textStyles.bold, { color: color ?? colors.text }, style]} onPress={onPress}>
      {children}
    </Text>
  );
}
