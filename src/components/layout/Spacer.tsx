/**
 * Spacer — explicit whitespace using token values.
 *
 * Three modes:
 * - <Spacer size="lg" />         fixed vertical space (token key or raw number)
 * - <Spacer flex />              flex: 1 — pushes siblings apart in a Row/Stack
 * - <Spacer horizontal size="sm" /> fixed horizontal space
 *
 * Use <Spacer flex /> instead of <View style={{ flex: 1 }} /> when the intent
 * is to push siblings to opposite ends of a Row — it makes the intent named.
 */
import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme/tokens';

type SpacingKey = keyof typeof spacing;

interface SpacerProps {
  size?: SpacingKey | number;
  flex?: boolean;
  horizontal?: boolean;
}

export function Spacer({ size, flex, horizontal }: SpacerProps) {
  if (flex) return <View style={{ flex: 1 }} />;
  const val = size === undefined ? spacing.md : typeof size === 'string' ? spacing[size] : size;
  return <View style={horizontal ? { width: val } : { height: val }} />;
}
