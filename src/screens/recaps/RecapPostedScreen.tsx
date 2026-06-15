import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { FadeUp } from '@/components/atoms/FadeUp';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'RecapPosted'>;

// Recaps are moderation-gated on the backend: a freshly posted recap is
// `pending` and only becomes visible to others once it's approved. The success
// screen reflects that "in review" state rather than promising instant
// visibility (Wave 5 UI change to match the moderation business rule).
export function RecapPostedScreen({ navigation }: Props) {
  const { colors } = useTheme();

  return (
    <Screen scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <FadeUp duration={400}>
          <IconBox size={72} radius={22} backgroundColor={colors.cost.freeBg} style={{ marginBottom: spacing.lg + 4 }}>
            <Icon name="image" size={34} color={colors.green} />
          </IconBox>
        </FadeUp>
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Recap shared!</T.Display></FadeUp>
        <FadeUp duration={400} delay={100}>
          <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 280, marginBottom: spacing.lg }}>
            It’s <T.Bold color={colors.text}>in review</T.Bold> and will appear in the feed once it’s approved — usually within a few minutes.
          </T.BodyLg>
        </FadeUp>
        <FadeUp duration={400} delay={130}>
          <Stack gap="sm" align="center" style={{ flexDirection: 'row', marginBottom: spacing.xxxl }}>
            <Icon name="clock" size={14} color={colors.textDim} />
            <T.MetaXs color={colors.textDim}>You’ll find it under your profile’s Recaps tab</T.MetaXs>
          </Stack>
        </FadeUp>
        <FadeUp duration={400} delay={150} style={{ width: '100%' }}>
          <Stack gap="sm">
            <Button variant="primary-coral" label="See all recaps" onPress={() => navigation.popToTop()} />
            <Button variant="secondary" label="Back to home" onPress={() => navigation.getParent()?.navigate('HomeTab' as never)} />
          </Stack>
        </FadeUp>
      </ScreenPad>
    </Screen>
  );
}
