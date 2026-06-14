import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii } from '@/theme/tokens';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsPrivacy'>;

const PROFILE_OPTS = [
  { val: 'everyone',  label: 'Everyone',        sub: 'Anyone on hopon can see your profile' },
  { val: 'followers', label: 'Followers only',  sub: 'Only people you follow back' },
  { val: 'nobody',    label: 'Nobody',           sub: 'Your profile is hidden' },
];

const PLAN_OPTS = [
  { val: 'everyone',  label: 'Everyone in my area' },
  { val: 'followers', label: 'Only followers' },
];

export function SettingsPrivacyScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [profileVis, setProfileVis] = useState('everyone');
  const [planVis, setPlanVis]       = useState('everyone');

  return (
    <Screen header={<ScreenHeader title="Privacy" onBack={() => navigation.goBack()} />}>
      <ScrollView style={{ flex: 1 }}>
        <ScreenPad style={{ paddingTop: spacing.lg }}>
          <T.CapsSm style={{ marginBottom: spacing.sm + 2 }}>Profile Visibility</T.CapsSm>
          <Stack gap="sm">
            {PROFILE_OPTS.map((o) => {
              const on = profileVis === o.val;
              return (
                <Pressable
                  key={o.val}
                  onPress={() => setProfileVis(o.val)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.lg,
                    paddingVertical: spacing.lg,
                    paddingHorizontal: spacing.lg,
                    borderWidth: borderWidths.medium,
                    borderRadius: radii.sm,
                    backgroundColor: on ? colors.surfaceMid : colors.surface,
                    borderColor: on ? colors.text : colors.border,
                  }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: borderWidths.thick,
                    borderColor: on ? colors.text : colors.borderMid,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text }} /> : null}
                  </View>
                  <View>
                    <T.Semibold color={colors.text}>{o.label}</T.Semibold>
                    <T.Meta color={colors.textSub}>{o.sub}</T.Meta>
                  </View>
                </Pressable>
              );
            })}
          </Stack>

          <T.CapsSm style={{ marginTop: spacing.xl - 2, marginBottom: spacing.sm + 2 }}>Who Can See My Plans</T.CapsSm>
          <Stack gap="sm">
            {PLAN_OPTS.map((o) => {
              const on = planVis === o.val;
              return (
                <Pressable
                  key={o.val}
                  onPress={() => setPlanVis(o.val)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.lg,
                    paddingVertical: spacing.lg,
                    paddingHorizontal: spacing.lg,
                    borderWidth: borderWidths.medium,
                    borderRadius: radii.sm,
                    backgroundColor: on ? colors.surfaceMid : colors.surface,
                    borderColor: on ? colors.text : colors.border,
                  }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: borderWidths.thick,
                    borderColor: on ? colors.text : colors.borderMid,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text }} /> : null}
                  </View>
                  <T.Semibold color={colors.text}>{o.label}</T.Semibold>
                </Pressable>
              );
            })}
          </Stack>
        </ScreenPad>
        <Spacer size="xxxl" />
      </ScrollView>
    </Screen>
  );
}
