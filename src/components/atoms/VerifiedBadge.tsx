import React from 'react';
import { View } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '@/theme';
import { borderWidths } from '@/theme/tokens';

export function VerifiedBadge() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: borderWidths.thick,
        borderColor: colors.bg,
        backgroundColor: colors.cost.freeBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="badge-check" size={12} color={colors.green} />
    </View>
  );
}
