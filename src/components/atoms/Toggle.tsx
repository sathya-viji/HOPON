import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel?: string;
}

export function Toggle({ value, onChange, accessibilityLabel }: ToggleProps) {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const trackOn = isDark ? colors.coral : colors.black;
  const trackOff = isDark ? '#3A3A3A' : colors.border;
  const knobColor = isDark ? '#FFFFFF' : '#FFFFFF';

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 18 : 0, { duration: 180 }) }],
  }));

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.track, { backgroundColor: value ? trackOn : trackOff }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.knob, { backgroundColor: knobColor }, knobStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 20, height: 20, borderRadius: 10 },
});
