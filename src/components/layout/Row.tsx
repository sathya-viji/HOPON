/**
 * Row — horizontal flex container with token-based gap.
 *
 * The gap prop accepts a spacing token key ('sm', 'md', 'lg') or a raw number
 * for the rare cases where no token fits exactly. Default alignItems is 'center'
 * because the overwhelming majority of row layouts vertically centre their children.
 *
 * Use `wrap` for pill/tag collections that need to flow onto multiple lines.
 * Use `justify` for space-between or flex-end layouts.
 * Use `flex` to make the Row fill available space in a parent container.
 */
import React from 'react';
import { View, ViewStyle, StyleProp, FlexAlignType } from 'react-native';
import { spacing } from '@/theme/tokens';

type SpacingKey = keyof typeof spacing;

interface RowProps {
  gap?: SpacingKey | number;
  align?: FlexAlignType;
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Row({ gap, align = 'center', justify, wrap, flex, style, children }: RowProps) {
  const gapValue = gap === undefined ? 0 : typeof gap === 'string' ? spacing[gap] : gap;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          gap: gapValue,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : undefined,
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
