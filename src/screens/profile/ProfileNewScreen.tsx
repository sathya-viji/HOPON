import React from 'react';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { TrustGrid } from '@/components/molecules/TrustGrid';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths } from '@/theme/tokens';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ProfileNew'>;

export function ProfileNewScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const header = (
    <ScreenPad>
      <Row style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header} scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <Stack style={{ width: 80, height: 80, borderRadius: 24, borderWidth: borderWidths.medium, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, borderColor: colors.borderMid, backgroundColor: colors.surface }}>
          <Icon name="user" size={34} color={colors.textDim} />
        </Stack>
        <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>You're new here 👋</T.Subheading>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.md }}>
          Your profile fills up as you join plans. Start with one plan nearby.
        </T.BodyLg>
        <TrustGrid hosted={0} joined={0} attendance={null} met={0} />
        <Stack gap="sm" style={{ width: '100%', marginTop: spacing.sm }}>
          <Button variant="primary-coral" label="See what's happening nearby" onPress={() => navigation.getParent()?.navigate('HomeTab' as never)} />
          <Pressable onPress={() => navigation.navigate('ProfileIncomplete')} style={{ alignSelf: 'center', padding: spacing.xs }}>
            <T.Semibold color={colors.textDim}>Complete my profile</T.Semibold>
          </Pressable>
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
