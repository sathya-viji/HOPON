import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

interface LiveDotProps {
  size?: number;
  color?: string;
}

export function LiveDot({ size = 6, color }: LiveDotProps) {
  const { colors } = useTheme();
  const dotColor = color ?? colors.coral;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2.4, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [scale, opacity]);

  const ripple = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ripple,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor },
          ripple,
        ]}
      />
      <View
        style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute' },
  dot: {},
});
