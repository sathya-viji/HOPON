import React from 'react';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'HomeEmpty'>;

const NEIGHBOURHOOD = 'HSR Layout';

export function HomeEmptyScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const header = (
    <Row gap="sm" style={{ paddingHorizontal: spacing.screenPx, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
      <Row gap="sm" style={{ paddingHorizontal: spacing.sm + 2, height: 32, borderWidth: borderWidths.medium, borderRadius: radii.full, backgroundColor: colors.surface, borderColor: colors.border }}>
        <Icon name="map-pin" size={iconSizes.xxs + 3} color={colors.coral} />
        <T.LabelXs>{NEIGHBOURHOOD}</T.LabelXs>
      </Row>
    </Row>
  );

  return (
    <Screen header={header} scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl + spacing.lg }}>
        <IconBox size={64} radius={20} bordered style={{ marginBottom: spacing.lg + 4 }}>
          <Icon name="map-pin" size={28} color={colors.textDim} />
        </IconBox>
        <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>No plans in {NEIGHBOURHOOD}</T.Subheading>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
          Be the first to post one. Plans go live instantly — someone nearby might hop on.
        </T.BodyLg>
        <Button variant="primary-coral" label="+ Post a plan" onPress={() => navigation.navigate('Create')} />
        <Row gap={2} style={{ marginTop: spacing.md }}>
          <T.Meta>or </T.Meta>
          <Pressable onPress={() => navigation.getParent()?.navigate('ProfileTab' as never)} hitSlop={spacing.sm} accessibilityRole="link">
            <T.Semibold color={colors.coral}>see plans in nearby areas →</T.Semibold>
          </Pressable>
        </Row>
      </ScreenPad>
    </Screen>
  );
}
