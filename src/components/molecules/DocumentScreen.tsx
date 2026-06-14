import React from 'react';
import { View, Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths } from '@/theme/tokens';

interface DocumentScreenProps {
  title: string;
  updatedLabel?: string;
  sections: [string, string][];
  contactPrompt: string;
  contactEmail: string;
  onBack: () => void;
}

export function DocumentScreen({
  title,
  updatedLabel = 'Last updated: January 2025',
  sections,
  contactPrompt,
  contactEmail,
  onBack,
}: DocumentScreenProps) {
  const { colors } = useTheme();
  return (
    <Screen header={<ScreenHeader title={title} onBack={onBack} />}>
      <ScreenPad style={{ paddingTop: spacing.xl, paddingBottom: spacing.xxxl }}>
        <T.Meta style={{ marginBottom: spacing.xl }}>{updatedLabel}</T.Meta>
        <Stack gap="xl">
          {sections.map(([h, b]) => (
            <Stack key={h} gap="sm">
              <T.LabelLg>{h}</T.LabelLg>
              <T.BodyMd color={colors.textSub}>{b}</T.BodyMd>
            </Stack>
          ))}
        </Stack>
        <View
          style={{
            marginTop: spacing.sm,
            padding: spacing.lg,
            borderRadius: radii.sm,
            borderWidth: borderWidths.thin,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <T.Meta>
            {contactPrompt}{' '}
            <Text style={{ color: colors.coral }}>{contactEmail}</Text>
          </T.Meta>
        </View>
      </ScreenPad>
    </Screen>
  );
}
