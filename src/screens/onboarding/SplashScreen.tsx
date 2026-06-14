import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import type { StackScreenProps } from '@react-navigation/stack';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors as colorTokens, radii, fontFamilies, shadow } from '@/theme/tokens';
import { FadeUp } from '@/components/atoms/FadeUp';
import { Icon, IconName } from '@/components/atoms/Icon';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'Splash'>;

const BLACK = colorTokens.black;
const CORAL = colorTokens.coral;
const WHITE = colorTokens.white;

// absoluteFill is a structural layout constant — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

const BOARD_ROWS = [
  { label: 'Badminton', where: 'Play Arena', time: 'STARTS IN 08:42', spots: '2 SPOTS', tileBg: '#E8F5E9', icon: 'dumbbell' as IconName, iconColor: '#2E7D32' },
  { label: 'Coffee', where: 'Third Wave', time: 'STARTS IN 22:15', spots: '1 SPOT', tileBg: '#FFF4DC', icon: 'utensils' as IconName, iconColor: '#B8860B' },
  { label: 'Morning run', where: 'Cubbon Park', time: 'STARTS IN 38:00', spots: '4 SPOTS', tileBg: '#F0FFF4', icon: 'trees' as IconName, iconColor: '#1B5E20' },
];

export function SplashScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: BLACK, overflow: 'hidden' }}>
      <StatusBar style="light" />

      {/* Subtle grid overlay */}
      <View style={StyleSheet_absoluteFill}>
        <Svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <Defs>
            <Pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <Path d="M 40 0 L 0 0 0 40" stroke={WHITE} strokeWidth="1" fill="none" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grid)" />
        </Svg>
      </View>

      {/* Top section — live board */}
      <View style={{ paddingHorizontal: 28, paddingTop: Math.max(insets.top + 8, 52) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <PulseDot />
          <Text style={{ fontFamily: fontFamilies.bold, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.14 * 10 }}>LIVE · HSR LAYOUT</Text>
        </View>

        {BOARD_ROWS.map((row, i) => (
          <FadeUp key={row.label} delay={i * 80} duration={400} translateY={6} style={{ opacity: 1 - i * 0.18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: row.tileBg }}>
                <Icon name={row.icon} size={18} color={row.iconColor} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fontFamilies.extrabold, fontSize: 14, color: WHITE, letterSpacing: -0.01 * 14 }} numberOfLines={1}>{row.label}</Text>
                <Text style={{ fontFamily: fontFamilies.regular, fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 }} numberOfLines={1}>{row.where}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Text style={{ fontFamily: fontFamilies.bold, fontSize: 11, color: CORAL, fontVariant: ['tabular-nums'] }}>{row.time}</Text>
                <Text style={{ fontFamily: fontFamilies.bold, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.04 * 10, marginTop: 2 }}>{row.spots}</Text>
              </View>
            </View>
          </FadeUp>
        ))}
      </View>

      {/* Bottom section — headline + CTAs */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: Math.max(insets.bottom + 8, 44) }}>
        <FadeUp delay={250} duration={500} style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 38, color: WHITE, letterSpacing: -0.03 * 38, lineHeight: 38 * 1.05, marginBottom: 12 }}>{'Show up.\nBuild your\nsocial life.'}</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 14 * 1.6, maxWidth: 260 }}>Real plans. Real people. No coordination overhead.</Text>
        </FadeUp>

        <FadeUp delay={350} duration={500}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('SignupPhone'); }}
            style={({ pressed }) => [{ width: '100%', backgroundColor: CORAL, borderRadius: radii.xl, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10, ...shadow.coral }, pressed ? { transform: [{ scale: 0.97 }] } : null]}
            accessibilityRole="button"
            accessibilityLabel="See what's happening"
          >
            <Text style={{ fontFamily: fontFamilies.extrabold, fontSize: 16, color: WHITE, letterSpacing: 0.02 * 16 }}>See what's happening →</Text>
          </Pressable>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Login'); }}
            style={({ pressed }) => [{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: radii.xl, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }, pressed ? { transform: [{ scale: 0.97 }] } : null]}
            accessibilityRole="button"
            accessibilityLabel="I already have an account"
          >
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>I already have an account</Text>
          </Pressable>
        </FadeUp>
      </View>
    </View>
  );
}

function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(0.85, { duration: 750 }), withTiming(1, { duration: 750 })), -1, false);
    opacity.value = withRepeat(withSequence(withTiming(0.45, { duration: 750 }), withTiming(1, { duration: 750 })), -1, false);
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: CORAL }, animatedStyle]} />;
}
