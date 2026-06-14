import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { NavBar, NavTab } from '@/components/organisms/NavBar';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

interface PlaceholderProps {
  name: string;
  description?: string;
  navTab?: NavTab;
  onHomePress?: () => void;
  onNotificationsPress?: () => void;
  onRecapsPress?: () => void;
  onProfilePress?: () => void;
  onCreatePress?: () => void;
}

export function Placeholder({ name, description, navTab, onHomePress, onNotificationsPress, onRecapsPress, onProfilePress, onCreatePress }: PlaceholderProps) {
  const { colors } = useTheme();

  const footer = navTab ? (
    <NavBar active={navTab} onHomePress={onHomePress} onNotificationsPress={onNotificationsPress} onRecapsPress={onRecapsPress} onProfilePress={onProfilePress} onCreatePress={onCreatePress} />
  ) : undefined;

  return (
    <Screen footer={footer}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
        <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>{name}</T.Subheading>
        {description ? <T.BodyMd color={colors.textSub} style={{ textAlign: 'center', marginBottom: spacing.lg, maxWidth: 280 }}>{description}</T.BodyMd> : null}
        <T.CapsSm>Placeholder · Group 0 skeleton</T.CapsSm>
      </ScreenPad>
    </Screen>
  );
}
