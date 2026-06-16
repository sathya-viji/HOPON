import React, { useState, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { useToast } from '@/hooks/useToast';
import { signOut } from '@/api/auth';
import { getMyProfile } from '@/api/users';
import { inviteContacts, getInviteStats, type InviteStats } from '@/api/growth';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/state/AuthContext';
import type { User } from '@/types';
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
  const [me, setMe] = useState<User | null>(null);
  const [invites, setInvites] = useState<InviteStats>({ pending: 0, converted: 0 });
  const [inviting, setInviting] = useState(false);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    getMyProfile().then((p) => { if (!cancelled) setMe(p); }).catch(() => {});
    getInviteStats().then((s) => { if (!cancelled) setInvites(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []));

  const onInvite = async () => {
    if (inviting) return;
    setInviting(true);
    try {
      const res = await inviteContacts();
      if (res.status === 'sent') toast.show(res.count > 0 ? `Invited ${res.count} ${res.count === 1 ? 'friend' : 'friends'} to hopon 🎉` : 'All your contacts are already on hopon!');
      else if (res.status === 'denied') toast.show('Contact access denied — enable it in Settings to invite friends');
      else if (res.status === 'no_contacts') toast.show('No contacts found to invite');
      else toast.show('Couldn’t send invites. Try again.');
      getInviteStats().then(setInvites).catch(() => {});
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t send invites.'));
    } finally {
      setInviting(false);
    }
  };

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
              <Avatar uri={me?.avatarUri} name={me?.name ?? '…'} size={avatarSizes.md} shape="rounded" />
              <View style={{ flex: 1 }}>
                <T.LabelLg>{me?.name ?? 'Your profile'}</T.LabelLg>
                <T.Meta style={{ marginTop: 2 }}>{me ? `${me.handle} · ${me.neighbourhood}` : 'View and edit your profile'}</T.Meta>
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
        <SettingsRow icon="map-pin" label="Neighbourhood" sub={me?.neighbourhood ?? ''} onPress={() => navigation.navigate('SettingsNeighbourhood')} />

        <SectionLabel label="ACCOUNT" />
        <SettingsRow icon="user" label="Edit profile" onPress={() => navigation.navigate('ProfileEdit')} />
        <SettingsRow icon="bell" label="Notifications" sub="All on" onPress={() => navigation.navigate('SettingsNotifications')} />
        <SettingsRow icon="shield-check" label="Privacy" sub="Public profile" onPress={() => navigation.navigate('SettingsPrivacy')} />

        <SectionLabel label="GROW" />
        <SettingsRow
          icon="users"
          label={inviting ? 'Inviting…' : 'Invite friends'}
          sub={invites.converted > 0 ? `${invites.converted} joined · ${invites.pending} pending` : 'Bring your friends to hopon'}
          onPress={onInvite}
        />

        <SectionLabel label="COMMUNITY" />
        <SettingsRow icon="book-open" label="Community guidelines" onPress={() => navigation.navigate('Guidelines')} />
        <SettingsRow icon="flag" label="Report a problem" onPress={() => navigation.navigate('ReportProblem')} />
        <SettingsRow icon="ban" label="Blocked users" onPress={() => navigation.navigate('SettingsBlocked')} />

        <SectionLabel label="LEGAL" />
        <SettingsRow icon="info" label="Terms of Service" onPress={() => navigation.navigate('Terms')} />
        <SettingsRow icon="info" label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />

        {__DEV__ && (
          <>
            <SectionLabel label="DEVELOPER" />
            <SettingsRow icon="settings" label="Push Debug" sub="Expo push token diagnostics" onPress={() => navigation.navigate('PushDebug')} />
          </>
        )}

        <Spacer size="sm" />
        <SettingsRow icon="log-out" label="Log out" onPress={onLogout} />
        <SettingsRow icon="trash-2" label="Delete account" destructive onPress={() => navigation.navigate('SettingsDelete')} />

        <ScreenPad style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
          <T.MetaXs>{`hopon v4.0 · Made with ❤️ in India`}</T.MetaXs>
        </ScreenPad>
      </ScrollView>
    </Screen>
  );
}
