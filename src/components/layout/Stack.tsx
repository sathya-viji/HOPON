/**
 * Stack — vertical flex container with token-based gap.
 *
 * Unlike Row, Stack has no default alignItems — children stretch to fill the
 * container width, matching standard column layout behaviour. Set `align` only
 * when centre or flex-end alignment is explicitly needed.
 *
 * Prefer Stack over bare <View> whenever children are stacked vertically with
 * consistent spacing. The named gap makes intent explicit and keeps spacing
 * values on the token scale.
 */
import React from 'react';
import { View, ViewStyle, StyleProp, FlexAlignType } from 'react-native';
import { spacing } from '@/theme/tokens';

type SpacingKey = keyof typeof spacing;

interface StackProps {
  gap?: SpacingKey | number;
  align?: FlexAlignType;
  justify?: ViewStyle['justifyContent'];
  flex?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Stack({ gap, align, justify, flex, style, children }: StackProps) {
  const gapValue = gap === undefined ? 0 : typeof gap === 'string' ? spacing[gap] : gap;
  return (
    <View
      style={[
        {
          flexDirection: 'column',
          gap: gapValue,
          alignItems: align,
          justifyContent: justify,
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
