import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '@/theme';
import { radii, layout, shadow } from '@/theme/tokens';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { Tap } from '@/components/atoms/Tap';

export type NavTab = 'home' | 'notifications' | 'map' | 'recaps' | 'profile';

interface NavBarProps {
  active: NavTab;
  // Full-bleed screens (e.g. the map) render this as an absolute overlay so
  // content extends behind it, instead of the bar reserving its own layout
  // space and pushing content up (the default, used everywhere else).
  overlay?: boolean;
  // Shown in place of the generic profile icon when available.
  myAvatarUri?: string;
  myName?: string;
  badges?: { notifications?: number };
  onHomePress?: () => void;
  onNotificationsPress?: () => void;
  onMapPress?: () => void;
  onRecapsPress?: () => void;
  onProfilePress?: () => void;
}

interface Item {
  id: NavTab;
  label: string;
  icon: IconName;
}

const ITEMS_LEFT: Item[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'map', label: 'Map', icon: 'map' },
];
const ITEMS_CENTER: Item[] = [
  { id: 'notifications', label: 'Notifs', icon: 'bell' },
];
const ITEMS_RIGHT: Item[] = [
  { id: 'recaps', label: 'Recaps', icon: 'image' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

const AnimatedView = Animated.createAnimatedComponent(View);

function BadgeDot({ count, bgColor, borderColor }: { count: number; bgColor: string; borderColor: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.45, { damping: 8, stiffness: 500 }),
      withSpring(1, { damping: 12, stiffness: 400 }),
    );
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <AnimatedView style={[styles.badge, { backgroundColor: bgColor, borderColor }, animatedStyle]} />;
}

export function NavBar({
  active,
  overlay,
  myAvatarUri,
  myName,
  badges,
  onHomePress,
  onNotificationsPress,
  onMapPress,
  onRecapsPress,
  onProfilePress,
}: NavBarProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? Math.min(insets.bottom, 20) : insets.bottom;
  // GlassView renders real iOS 26 Liquid Glass and otherwise falls back to a
  // plain View — give that fallback (Android, iOS <26) an opaque background
  // instead of an unstyled transparent box.
  const glassAvailable = isLiquidGlassAvailable();

  const handlers: Record<NavTab, (() => void) | undefined> = {
    home: onHomePress,
    notifications: onNotificationsPress,
    map: onMapPress,
    recaps: onRecapsPress,
    profile: onProfilePress,
  };

  const renderItem = (item: Item) => {
    const isActive = item.id === active;
    const color = isActive ? colors.text : colors.textSub;
    const badge = item.id === 'notifications' ? badges?.notifications : undefined;

    return (
      <Tap
        key={item.id}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handlers[item.id]?.();
        }}
        style={styles.navBtn}
        hitSlop={8}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
      >
        {item.id === 'profile' ? (
          <View style={[styles.avatarRing, isActive && { borderColor: colors.text }]}>
            <Avatar uri={myAvatarUri} name={myName} size={22} />
          </View>
        ) : (
          <Icon name={item.icon} size={22} color={color} strokeWidth={isActive ? 2 : 1.75} />
        )}
        {badge ? (
          <BadgeDot count={badge} bgColor={colors.coral} borderColor={colors.bg} />
        ) : null}
      </Tap>
    );
  };

  return (
    <View style={[styles.wrapper, overlay && styles.wrapperOverlay, { paddingBottom: bottomInset || 12 }]}>
      <GlassView
        glassEffectStyle="regular"
        colorScheme={mode}
        style={[styles.bar, { height: layout.navBarHeight }, !glassAvailable && { backgroundColor: colors.bg }, shadow.lg]}
      >
        {ITEMS_LEFT.map(renderItem)}
        {ITEMS_CENTER.map(renderItem)}
        {ITEMS_RIGHT.map(renderItem)}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  wrapperOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderRadius: radii.full,
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 3,
    minWidth: 44,
    minHeight: 44,
    position: 'relative',
  },
  avatarRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
});
