/**
 * MapPin — a plan's marker on HomeMapScreen: a plain circle (theme
 * background, not category-tinted) with the plan's category emoji large and
 * centered, and a prominent host-avatar badge overlaid on the corner. No time
 * text on the pin itself. Modeled directly on the migomap reference the user
 * shared — see PROJECT chat history for the screenshots.
 */
import React from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { CATEGORIES } from '@/theme/tokens';
import type { Plan } from '@/types';

interface MapPinProps {
  plan: Plan;
}

const CIRCLE_SIZE = 52;
const AVATAR_SIZE = 28;

export function MapPin({ plan }: MapPinProps) {
  const { colors, mode } = useTheme();
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId);
  // Icons-instead-of-emoji check: per-category color for contrast against
  // the plain circle bg, same palette the rest of the app already uses.
  const iconColor = (mode === 'dark' ? cat?.darkIconColor : cat?.iconColor) ?? colors.textSub;

  return (
    <View style={{ width: CIRCLE_SIZE + AVATAR_SIZE / 2, height: CIRCLE_SIZE + AVATAR_SIZE / 2 }}>
      {/* Manual faux-shadow: Android's Marker rasterizes this view to a
          bitmap for the map layer, and elevation shadows are drawn by the
          hardware renderer rather than the Canvas draw pass that snapshot
          uses -- so `elevation` alone silently produces no shadow there.
          A plain translucent circle behind, offset down, renders reliably
          on both platforms regardless of how the marker gets captured. */}
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: 0,
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          backgroundColor: 'rgba(0,0,0,0.16)',
        }}
      />
      <View
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Icon name={(cat?.icon ?? 'sparkles') as never} size={24} color={iconColor} strokeWidth={2} />
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          borderRadius: AVATAR_SIZE / 2,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Avatar uri={plan.host?.avatarUri} name={plan.host?.name} size={AVATAR_SIZE} border />
      </View>
    </View>
  );
}
