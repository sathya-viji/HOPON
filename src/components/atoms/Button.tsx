import React from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { radii, layout, fontFamilies, letterSpacing, shadow } from '@/theme/tokens';
import { Icon, IconName } from './Icon';

export type ButtonVariant =
  | 'primary'
  | 'primary-coral'
  | 'secondary'
  | 'join'
  | 'join-joined'
  | 'join-mine'
  | 'join-full'
  | 'back';

interface ButtonProps {
  variant: ButtonVariant;
  label?: string;
  leadingIcon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ variant, label, leadingIcon, onPress, disabled, loading }: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const isInline = variant === 'join' || variant === 'join-joined' || variant === 'join-mine' || variant === 'join-full';
  const isFull = variant === 'join-full';
  const isBack = variant === 'back';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const triggerHaptic = () => {
    if (variant === 'primary' || variant === 'primary-coral') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (variant === 'join') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onPressIn = () => {
    if (isFull || disabled) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const onPressOut = () => {
    if (isFull || disabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    if (isFull || disabled || loading) return;
    triggerHaptic();
    onPress?.();
  };

  const variantStyle = getVariantStyle(variant, colors, disabled);

  // The touch target is a plain RN Pressable (reliable full-area hitbox on
  // Fabric); the press-scale animation lives on an inner Animated.View. Wrapping
  // the Pressable itself in Reanimated's animated component collapsed the touch
  // area to the inner content on Android, so only the centre/text was tappable.
  if (isBack) {
    return (
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Animated.View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }, animatedStyle]}>
          <Icon name="chevron-left" size={20} color={colors.text} />
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isFull || disabled || loading}
      style={isInline ? undefined : styles.fullWidth}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.base,
          variantStyle.container,
          isInline ? styles.inline : styles.block,
          animatedStyle,
        ]}
      >
        <View style={styles.row}>
          {loading ? (
            <ActivityIndicator color={variantStyle.text.color} size="small" />
          ) : (
            <>
              {leadingIcon ? (
                <Icon name={leadingIcon} size={isInline ? 12 : 16} color={variantStyle.text.color} strokeWidth={2.25} />
              ) : null}
              <Text style={[variantStyle.text, isInline ? styles.inlineText : styles.blockText]} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function getVariantStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  disabled?: boolean,
): { container: object; text: { color: string } } {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: disabled ? colors.surfaceMid : colors.black,
          borderRadius: radii.xl,
        },
        text: { color: disabled ? colors.textDim : colors.white },
      };
    case 'primary-coral':
      return {
        container: {
          backgroundColor: disabled ? colors.surfaceMid : colors.coral,
          borderRadius: radii.xl,
          ...(disabled ? {} : shadow.coral),
        },
        text: { color: disabled ? colors.textDim : colors.white },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        text: { color: colors.text },
      };
    case 'join':
      return {
        container: { backgroundColor: colors.black, borderRadius: radii.sm },
        text: { color: colors.white },
      };
    case 'join-joined':
      return {
        container: {
          backgroundColor: colors.cost.freeBg,
          borderRadius: radii.sm,
          borderWidth: 1.5,
          borderColor: colors.cost.freeFg,
        },
        text: { color: colors.cost.freeFg },
      };
    case 'join-mine':
      return {
        container: {
          backgroundColor: colors.cost.copayBg,
          borderRadius: radii.sm,
          borderWidth: 1.5,
          borderColor: colors.cost.copayFg,
        },
        text: { color: colors.cost.copayFg },
      };
    case 'join-full':
      return {
        container: {
          backgroundColor: colors.surface,
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        text: { color: colors.textDim },
      };
    default:
      return {
        container: {},
        text: { color: colors.text },
      };
  }
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTapTarget,
  },
  block: { paddingVertical: 14, paddingHorizontal: 16, width: '100%' },
  inline: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockText: {
    fontSize: 16,
    fontFamily: fontFamilies.extrabold,
    letterSpacing: letterSpacing.cta * 16,
  },
  inlineText: {
    fontSize: 12,
    fontFamily: fontFamilies.extrabold,
    letterSpacing: letterSpacing.cta * 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
