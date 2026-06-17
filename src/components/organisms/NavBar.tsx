import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { radii, layout, fontFamilies, shadow } from '@/theme/tokens';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Tap } from '@/components/atoms/Tap';

export type NavTab = 'home' | 'notifications' | 'recaps' | 'profile';

interface NavBarProps {
  active: NavTab;
  badges?: { notifications?: number };
  onHomePress?: () => void;
  onNotificationsPress?: () => void;
  onRecapsPress?: () => void;
  onProfilePress?: () => void;
  onCreatePress?: () => void;
}

interface Item {
  id: NavTab;
  label: string;
  icon: IconName;
}

const ITEMS_LEFT: Item[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'notifications', label: 'Notifs', icon: 'bell' },
];
const ITEMS_RIGHT: Item[] = [
  { id: 'recaps', label: 'Recaps', icon: 'image' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

const AnimatedView = Animated.createAnimatedComponent(View);

function BadgePill({ count, bgColor, borderColor, textColor }: { count: number; bgColor: string; borderColor: string; textColor: string }) {
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

  return (
    <AnimatedView style={[styles.badge, { backgroundColor: bgColor, borderColor }, animatedStyle]}>
      <Text style={[styles.badgeText, { color: textColor }]}>
        {count > 99 ? '99+' : count}
      </Text>
    </AnimatedView>
  );
}

export function NavBar({
  active,
  badges,
  onHomePress,
  onNotificationsPress,
  onRecapsPress,
  onProfilePress,
  onCreatePress,
}: NavBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? Math.min(insets.bottom, 20) : insets.bottom;

  const handlers: Record<NavTab, (() => void) | undefined> = {
    home: onHomePress,
    notifications: onNotificationsPress,
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
        <Icon name={item.icon} size={22} color={color} strokeWidth={isActive ? 2 : 1.75} />
        <Text
          style={[
            styles.navLabel,
            { color, fontFamily: isActive ? fontFamilies.bold : fontFamilies.semibold },
          ]}
        >
          {item.label}
        </Text>
        {badge ? (
          <BadgePill count={badge} bgColor={colors.coral} borderColor={colors.bg} textColor={colors.white} />
        ) : null}
      </Tap>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: layout.navBarHeight + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {ITEMS_LEFT.map(renderItem)}
      <Tap
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onCreatePress?.();
        }}
        style={[styles.createBtn, { backgroundColor: colors.coral }, shadow.coral]}
        accessibilityLabel="Create a plan"
      >
        <Icon name="plus" size={26} color={colors.white} strokeWidth={2.5} />
      </Tap>
      {ITEMS_RIGHT.map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderTopWidth: 1,
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
  navLabel: { fontSize: 10 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: radii.full,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: fontFamilies.bold,
  },
  createBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
