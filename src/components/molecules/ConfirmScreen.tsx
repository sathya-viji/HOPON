import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import * as T from '@/components/atoms/T';
import { spacing } from '@/theme/tokens';

interface ConfirmScreenProps {
  onBack?: () => void;
  icon: React.ReactNode;
  title: string;
  sub: React.ReactNode;
  notice?: string;
  children: React.ReactNode;
}

export function ConfirmScreen({ onBack, icon, title, sub, notice, children }: ConfirmScreenProps) {
  return (
    <Screen header={onBack ? <ScreenHeader onBack={onBack} /> : undefined} scroll={false}>
      <ScreenPad style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxxl }}>
        {icon}
        <T.Heading style={{ marginBottom: spacing.sm, textAlign: 'center' }}>{title}</T.Heading>
        <T.BodyLg style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.sm }}>{sub}</T.BodyLg>
        {notice ? (
          <T.Meta style={{ marginBottom: spacing.xxxl + spacing.sm }}>{notice}</T.Meta>
        ) : null}
        <Stack gap="sm" style={{ width: '100%' }}>
          {children}
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
