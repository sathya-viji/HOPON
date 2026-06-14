import React from 'react';
import { Text } from 'react-native';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Row } from '@/components/layout/Row';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { spacing, radii, iconSizes, CATEGORIES } from '@/theme/tokens';

interface InterestPillsProps {
  interests: readonly string[];
}

export function InterestPills({ interests }: InterestPillsProps) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <Row
      wrap
      gap={6}
      align="flex-start"
      style={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.lg - 2 }}
    >
      {interests.map((id) => {
        const cat = CATEGORIES.find((c) => c.id === id);
        if (!cat) return null;
        const bg = isDark ? cat.darkBg : cat.bg;
        const fg = isDark ? cat.darkIconColor : cat.iconColor;
        return (
          <Row
            key={id}
            gap={5}
            style={{ paddingVertical: 5, paddingHorizontal: spacing.sm + 2, borderRadius: radii.full, backgroundColor: bg }}
          >
            <Icon name={cat.icon as IconName} size={iconSizes.xs} color={fg} />
            <Text style={[textStyles.labelSm, { color: fg }]}>{cat.label}</Text>
          </Row>
        );
      })}
    </Row>
  );
}
