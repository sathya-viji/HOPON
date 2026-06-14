import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { FadeUp } from '@/components/atoms/FadeUp';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanPosted'>;

/** Area from a venue label: "Third Wave Coffee, Koramangala" → "Koramangala".
 * Falls back to the whole label when there's no comma. */
function areaFromLabel(label?: string): string | null {
  if (!label?.trim()) return null;
  const parts = label.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

export function PlanPostedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const area = areaFromLabel(route.params?.locationLabel);

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <FadeUp duration={400}>
          <IconBox size={72} radius={22} backgroundColor={colors.cost.freeBg}>
            <Icon name="circle-check" size={36} color={colors.green} />
          </IconBox>
        </FadeUp>
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Plan is live!</T.Display></FadeUp>
        <FadeUp duration={400} delay={100}>
          <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
            {area ? (
              <>
                Your plan is now visible to everyone in{' '}
                <T.Bold color={colors.text}>{area}</T.Bold>. You'll get a notification when people join.
              </>
            ) : (
              <>Your plan is now live. You'll get a notification when people join.</>
            )}
          </T.BodyLg>
        </FadeUp>

        <FadeUp duration={400} delay={150} style={{ width: '100%' }}>
          <Pressable
            onPress={() => toast.show('Share')}
            style={{ padding: spacing.lg - 2, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl, backgroundColor: colors.surface }}
          >
            <Icon name="share-2" size={iconSizes.lg} color={colors.textSub} />
            <Stack gap={1} style={{ flex: 1 }}>
              <T.LabelMd>Share with friends</T.LabelMd>
              <T.Meta>Send the plan link directly</T.Meta>
            </Stack>
            <Icon name="chevron-right" size={iconSizes.sm} color={colors.textDim} />
          </Pressable>
        </FadeUp>

        <FadeUp duration={400} delay={200} style={{ width: '100%' }}>
          <Stack gap="sm">
            <Button variant="primary" label="View my plan" onPress={() => navigation.replace('PlanHost', { planId: route.params?.planId })} />
            <Button variant="secondary" label="Back to home" onPress={() => navigation.popToTop()} />
          </Stack>
        </FadeUp>
      </ScreenPad>
    </Screen>
  );
}
