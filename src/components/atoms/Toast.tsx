import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { radii, layout, fontFamilies, spacing, shadow } from '@/theme/tokens';
import { toastEmitter } from '@/hooks/useToast';

export function ToastContainer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(28);

  useEffect(() => {
    return toastEmitter.subscribe((m) => {
      setMsg(m);
      opacity.value = withTiming(1, { duration: 180 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 300 });
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(28, { duration: 180 }, (finished) => {
          if (finished) runOnJS(setMsg)(null);
        });
      }, 2500);
    });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!msg) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + layout.navBarHeight + 12 },
      ]}
    >
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.black },
          shadow.lg,
          animatedStyle,
        ]}
      >
        <Text style={[styles.text, { color: colors.white }]} numberOfLines={2}>
          {msg}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.screenPx,
    right: spacing.screenPx,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.lg,
    maxWidth: '100%',
  },
  text: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'center',
  },
});
