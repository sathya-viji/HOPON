import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface FadeUpProps {
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: any;
  children: React.ReactNode;
}

export function FadeUp({ delay = 0, duration = 400, translateY = 8, style, children }: FadeUpProps) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(translateY);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration, opacity, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
