/**
 * MapPin — a plan's marker on HomeMapScreen: the host's avatar with a small
 * category-icon badge and an urgency-coloured ring (coral when starting soon).
 */
import React from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { CATEGORIES } from '@/theme/tokens';
import { deriveUrgency } from '@/utils/plan';
import type { Plan } from '@/types';

const RING_SIZE = 52;
const AVATAR_SIZE = 44;
const BADGE_SIZE = 20;

interface MapPinProps {
  plan: Plan;
}

export function MapPin({ plan }: MapPinProps) {
  const { colors } = useTheme();
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId);
  const urgency = deriveUrgency(Math.max(0, plan.minutesUntilStart));
  const ringColor = urgency === 'now' ? colors.coral : '#fff';

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: 3,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Avatar uri={plan.host?.avatarUri} name={plan.host?.name} size={AVATAR_SIZE} />
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: BADGE_SIZE,
          height: BADGE_SIZE,
          borderRadius: BADGE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: cat?.bg ?? colors.surface,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      >
        <Icon name={(cat?.icon ?? 'sparkles') as never} size={10} color={cat?.iconColor ?? colors.textSub} strokeWidth={2.5} />
      </View>
    </View>
  );
}
