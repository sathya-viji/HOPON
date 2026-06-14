import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { borderWidths } from '@/theme/tokens';

interface DividerProps {
  color?: string;
}

export function Divider({ color }: DividerProps) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', height: borderWidths.thin, backgroundColor: color ?? colors.border }} />
  );
}
