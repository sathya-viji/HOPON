import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import * as T from '@/components/atoms/T';
import { Row } from '@/components/layout/Row';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { spacing } from '@/theme/tokens';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, trailing }: ScreenHeaderProps) {
  return (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        {onBack ? <Button variant="back" onPress={onBack} /> : null}
        {title ? <T.LabelLg style={{ flex: 1 }}>{title}</T.LabelLg> : null}
        {trailing ? (
          <Row gap="md" style={{ marginLeft: 'auto' }}>
            {trailing}
          </Row>
        ) : null}
      </Row>
    </ScreenPad>
  );
}
