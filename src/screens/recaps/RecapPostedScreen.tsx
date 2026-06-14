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
const NEIGHBOURHOOD = 'HSR Layout';

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
        <FadeUp duration={400} delay={50}><T.Display style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Recap posted!</T.Display></FadeUp>
        <FadeUp duration={400} delay={100}>
          <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
            Your moment is now visible to everyone in <T.Bold color={colors.text}>{NEIGHBOURHOOD}</T.Bold>.
          </T.BodyLg>
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
