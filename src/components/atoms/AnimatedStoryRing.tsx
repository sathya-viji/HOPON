import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';

interface AnimatedStoryRingProps {
  /** Outer diameter of the ring. */
  size?: number;
  /** Ring colour (defaults to coral via prop). */
  color: string;
  /** Ring stroke width. */
  thickness?: number;
  /** The inner content (the story image / avatar circle). */
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A continuously-spinning two-arc ring — the Instagram/WhatsApp "story is
 * uploading / in review" affordance. Two opposite border sides are transparent
 * so the coloured arcs read as a rotating loader; the inner content stays still.
 * Native-driven, so it keeps spinning smoothly without JS work.
 */
export function AnimatedStoryRing({ size = 58, color, thickness = 2.5, children, style }: AnimatedStoryRingProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: color,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate }],
        }}
      />
      {children}
    </View>
  );
}
