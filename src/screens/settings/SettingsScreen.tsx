import React from 'react';
import { ScrollView, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Toggle } from '@/components/atoms/Toggle';
import { SettingsRow } from '@/components/molecules/SettingsRow';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, iconSizes, avatarSizes } from '@/theme/tokens';
import { getUserById, CURRENT_USER_ID } from '@/mocks';
import { useToast } from '@/hooks/useToast';
import { signOut } from '@/api/auth';
import { useAuth } from '@/state/AuthContext';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'Settings'>;

function SectionLabel({ label }: { label: string }) {
  return (
    <ScreenPad style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
      <T.CapsSm>{label}</T.CapsSm>
    </ScreenPad>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const { colors, mode, toggleMode } = useTheme();
  const toast = useToast();
  const { refresh } = useAuth();
  const me = getUserById(CURRENT_USER_ID)!;

  const onLogout = async () => {
    await signOut();        // clears the session
    await refresh();        // auth gate → onboarding
    toast.show('Logged out');
  };

  return (
    <Screen header={<ScreenHeader title="Settings" onBack={() => navigation.goBack()} />}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => navigation.navigate('ProfileEdit')}
          style={{ borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}
        >
          <ScreenPad>
            <Row gap="lg" style={{ paddingVertical: spacing.lg }}>
              <Avatar uri={me.avatarUri} name={me.name} size={avatarSizes.md} shape="rounded" />
              <View style={{ flex: 1 }}>
                <T.LabelLg>{me.name}</T.LabelLg>
                <T.Meta style={{ marginTop: 2 }}>{me.handle} · {me.neighbourhood}</T.Meta>
              </View>
              <Icon name="chevron-right" size={iconSizes.sm} color={colors.textDim} />
            </Row>
          </ScreenPad>
        </Pressable>

        <SectionLabel label="APPEARANCE" />
        <SettingsRow
          icon="sparkles"
          label="Dark mode"
          sub={mode === 'dark' ? 'On' : 'Off'}
          trailing={<Toggle value={mode === 'dark'} onChange={toggleMode} accessibilityLabel="Toggle dark mode" />}
        />

        <SectionLabel label="LOCATION" />
        <SettingsRow icon="map-pin" label="Neighbourhood" sub={me.neighbourhood} onPress={() => navigation.navigate('SettingsNeighbourhood')} />

        <SectionLabel label="ACCOUNT" />
        <SettingsRow icon="user" label="Edit profile" onPress={() => navigation.navigate('ProfileEdit')} />
        <SettingsRow icon="bell" label="Notifications" sub="All on" onPress={() => navigation.navigate('SettingsNotifications')} />
        <SettingsRow icon="shield-check" label="Privacy" sub="Public profile" onPress={() => navigation.navigate('SettingsPrivacy')} />

        <SectionLabel label="COMMUNITY" />
        <SettingsRow icon="book-open" label="Community guidelines" onPress={() => navigation.navigate('Guidelines')} />
        <SettingsRow icon="flag" label="Report a problem" onPress={() => navigation.navigate('ReportProblem')} />
        <SettingsRow icon="ban" label="Blocked users" onPress={() => navigation.navigate('SettingsBlocked')} />

        <SectionLabel label="LEGAL" />
        <SettingsRow icon="info" label="Terms of Service" onPress={() => navigation.navigate('Terms')} />
        <SettingsRow icon="info" label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />

        <Spacer size="sm" />
        <SettingsRow icon="log-out" label="Log out" onPress={onLogout} />
        <SettingsRow icon="trash-2" label="Delete account" destructive onPress={() => navigation.navigate('SettingsDelete')} />

        <ScreenPad style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
          <T.MetaXs>{`hopon v4.0 · Made with ❤️ in Bangalore`}</T.MetaXs>
        </ScreenPad>
      </ScrollView>
    </Screen>
  );
}
