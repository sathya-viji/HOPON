import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { radii, fontFamilies, letterSpacing } from '@/theme/tokens';

interface CountdownProps {
  startsAt?: string;
  minutesUntilStart?: number;
  /** Plan lifecycle status — terminal states suppress the live ticker. */
  status?: 'active' | 'full' | 'cancelled' | 'expired' | 'ended';
}

type Urgency = 'now' | 'later';

// Coral blinking pill fires at ≤120 mins (2 hours before start)
function urgencyFor(mins: number): Urgency {
  if (mins <= 120) return 'now';
  return 'later';
}

// Per prototype line 851-862: tickerText(secs) → "STARTING NOW" | "STARTS IN MM:SS" | "STARTS IN XH XM"
function tickerText(totalSecs: number): { text: string; urgency: Urgency } {
  if (totalSecs <= 0) return { text: 'STARTING NOW', urgency: 'now' };
  const mins = Math.floor(totalSecs / 60);
  const urgency = urgencyFor(mins);
  if (mins < 60) {
    const mm = String(mins).padStart(2, '0');
    const ss = String(totalSecs % 60).padStart(2, '0');
    return { text: `STARTS IN ${mm}:${ss}`, urgency };
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { text: `STARTS IN ${h}H${m > 0 ? ' ' + m + 'M' : ''}`, urgency };
}

export function Countdown({ startsAt, minutesUntilStart, status }: CountdownProps) {
  const { colors } = useTheme();
  const terminal =
    status === 'ended' ? 'ENDED' : status === 'expired' ? 'EXPIRED' : status === 'cancelled' ? 'CANCELLED' : null;
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Live seconds-precision tick when startsAt is provided
  const [totalSecs, setTotalSecs] = useState(() => {
    if (startsAt) return Math.floor((new Date(startsAt).getTime() - Date.now()) / 1000);
    return Math.floor((minutesUntilStart ?? 0) * 60);
  });

  useEffect(() => {
    if (startsAt) {
      const tick = () => setTotalSecs(Math.floor((new Date(startsAt).getTime() - Date.now()) / 1000));
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
    setTotalSecs(Math.floor((minutesUntilStart ?? 0) * 60));
    return undefined;
  }, [startsAt, minutesUntilStart]);

  const { text, urgency } = tickerText(totalSecs);

  useEffect(() => {
    if (urgency === 'now' && !terminal) {
      opacity.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 750 }), withTiming(1, { duration: 750 })),
        -1,
        false,
      );
      scale.value = withRepeat(
        withSequence(withTiming(0.92, { duration: 750 }), withTiming(1, { duration: 750 })),
        -1,
        false,
      );
    } else {
      opacity.value = withTiming(1, { duration: 120 });
      scale.value = withTiming(1, { duration: 120 });
    }
  }, [urgency, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (terminal) {
    return (
      <View style={styles.plain}>
        <Text style={[styles.laterText, { color: colors.textDim }]}>{terminal}</Text>
      </View>
    );
  }

  if (urgency === 'now') {
    return (
      <Animated.View style={[styles.pill, { backgroundColor: colors.coral }, animatedStyle]}>
        <Text style={[styles.pillText, { color: colors.white }]}>{text}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.plain}>
      <Text style={[styles.laterText, { color: colors.textDim }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 11,
    letterSpacing: letterSpacing.cta * 11,
    fontVariant: ['tabular-nums'],
  },
  plain: { alignSelf: 'flex-start' },
  laterText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: letterSpacing.meta * 11,
    fontVariant: ['tabular-nums'],
  },
});
