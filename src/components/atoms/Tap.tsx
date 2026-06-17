import React from 'react';
import { Pressable, ViewStyle, StyleProp, AccessibilityRole } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface TapProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  children: React.ReactNode;
}

export function Tap({ onPress, onLongPress, style, hitSlop, disabled, accessibilityLabel, accessibilityRole, children }: TapProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  // Plain Pressable is the touch target (full-area hitbox on Fabric); the scale
  // animation lives on an inner Animated.View. Wrapping the Pressable itself in
  // Reanimated's animated component collapsed the touch area on Android.
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={hitSlop}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'button'}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
