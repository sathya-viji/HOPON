import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon, IconName } from './Icon';
import { CATEGORIES, radii } from '@/theme/tokens';

interface ActivityIconProps {
  categoryId: string;
  size?: number;
}

export function ActivityIcon({ categoryId, size = 40 }: ActivityIconProps) {
  const cat = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
  const iconSize = Math.round(size * 0.5);
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: cat.bg,
          borderRadius: size <= 24 ? radii.xs : radii.md,
        },
      ]}
    >
      <Icon name={cat.icon as IconName} size={iconSize} color={cat.iconColor} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
