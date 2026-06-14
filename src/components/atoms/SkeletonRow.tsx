import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { radii, spacing } from '@/theme/tokens';

export function SkeletonRow() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [opacity]);

  const shimmer = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Animated.View style={[styles.icon, { backgroundColor: colors.surfaceMid }, shimmer]} />
      <View style={styles.info}>
        <Animated.View
          style={[styles.bar, { width: '60%', height: 14, backgroundColor: colors.surfaceMid }, shimmer]}
        />
        <Animated.View
          style={[styles.bar, { width: '45%', height: 11, marginTop: 6, backgroundColor: colors.surfaceMid }, shimmer]}
        />
        <Animated.View
          style={[styles.bar, { width: '35%', height: 10, marginTop: 6, backgroundColor: colors.surfaceMid }, shimmer]}
        />
      </View>
      <Animated.View
        style={[styles.bar, { width: 48, height: 30, backgroundColor: colors.surfaceMid }, shimmer]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenPx,
    borderBottomWidth: 1,
  },
  icon: { width: 40, height: 40, borderRadius: radii.md },
  info: { flex: 1 },
  bar: { borderRadius: radii.xs },
});
