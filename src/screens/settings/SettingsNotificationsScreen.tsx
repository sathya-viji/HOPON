import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Icon } from '@/components/atoms/Icon';
import { Toggle } from '@/components/atoms/Toggle';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes } from '@/theme/tokens';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsNotifications'>;

const PREFS = [
  { section: 'Your plans', items: [
    { key: 'newJoin',    label: 'Someone joins',   sub: 'When a person hops on your plan' },
    { key: 'newRequest', label: 'Join request',    sub: 'When someone asks to join a closed plan' },
    { key: 'planEnded',  label: 'Plan ended',      sub: 'Reminder to endorse attendees and post a recap' },
    { key: 'newRecap',   label: 'Recap posted',    sub: 'When an attendee shares a moment from your plan' },
  ]},
  { section: 'Activity', items: [
    { key: 'approved',  label: 'Request approved', sub: 'When a host lets you in' },
    { key: 'declined',  label: 'Request declined', sub: 'When a host declines your request' },
    { key: 'newFollow', label: 'New follower',     sub: 'When someone starts following you' },
  ]},
];

export function SettingsNotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.flatMap((s) => s.items.map((i) => [i.key, true]))),
  );

  const allOn  = Object.values(prefs).every(Boolean);
  const allOff = Object.values(prefs).every((v) => !v);
  const set = (key: string, v: boolean) => setPrefs((p) => ({ ...p, [key]: v }));
  const toggleAll = () => {
    const next = !allOn;
    setPrefs((p) => Object.fromEntries(Object.keys(p).map((k) => [k, next])));
  };

  return (
    <Screen header={<ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Row
          gap="lg"
          style={{
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.screenPx,
            backgroundColor: colors.surface,
            borderBottomWidth: borderWidths.thin,
            borderBottomColor: colors.border,
          }}
        >
          <Stack gap={2} style={{ flex: 1 }}>
            <T.LabelLg>All notifications</T.LabelLg>
            <T.Meta>{allOn ? 'Everything is on' : allOff ? 'All off' : 'Some notifications off'}</T.Meta>
          </Stack>
          <Toggle value={allOn} onChange={toggleAll} accessibilityLabel="Toggle all notifications" />
        </Row>

        {PREFS.map((s) => (
          <View key={s.section}>
            <ScreenPad style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
              <T.CapsSm>{s.section.toUpperCase()}</T.CapsSm>
            </ScreenPad>
            {s.items.map((item) => (
              <Row
                key={item.key}
                gap="lg"
                style={{
                  paddingVertical: spacing.lg,
                  paddingHorizontal: spacing.screenPx,
                  borderBottomWidth: borderWidths.thin,
                  borderBottomColor: colors.border,
                }}
              >
                <Stack gap={2} style={{ flex: 1 }}>
                  <T.Semibold>{item.label}</T.Semibold>
                  <T.Meta>{item.sub}</T.Meta>
                </Stack>
                <Toggle value={!!prefs[item.key]} onChange={(v) => set(item.key, v)} accessibilityLabel={item.label} />
              </Row>
            ))}
          </View>
        ))}

        <Row
          gap="sm"
          align="flex-start"
          style={{
            margin: spacing.screenPx,
            padding: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.sm,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="info" size={iconSizes.xs} color={colors.textSub} />
          <T.Meta style={{ flex: 1 }}>
            Push notifications require permission from your device. These settings control what hopon sends when permission is granted.
          </T.Meta>
        </Row>
        <Spacer size="xxxl" />
      </ScrollView>
    </Screen>
  );
}
