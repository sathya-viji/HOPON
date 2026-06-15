/**
 * Push Debug — DEV-only diagnostics for Expo push tokens.
 *
 * Registered in ProfileStack only under `__DEV__` and reached from a dev-gated
 * row in Settings. Shows whether native push is available, the permission state,
 * the resolved EAS projectId, and the current ExponentPushToken — with copy /
 * share / re-register affordances. Not shipped in production builds.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Share } from 'react-native';
import { Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { getPushDebugInfo, registerForPushNotificationsAsync, resetPushRegistration, type PushDebugInfo } from '@/services/push';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'PushDebug'>;

function Field({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.sm, borderBottomWidth: borderWidths.hairline, borderBottomColor: colors.border }}>
      <T.CapsSm color={colors.textSub}>{label}</T.CapsSm>
      <T.BodyMd color={ok === false ? colors.coral : colors.text} style={{ marginTop: 2 }}>{value}</T.BodyMd>
    </View>
  );
}

export function PushDebugScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [info, setInfo] = useState<PushDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInfo(await getPushDebugInfo());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onShare = async () => {
    if (!info?.token) return;
    try {
      await Share.share({ message: info.token });
    } catch {
      /* user cancelled */
    }
  };

  const onReRegister = async () => {
    resetPushRegistration();
    await registerForPushNotificationsAsync();
    await load();
    toast.show('Re-registered token with backend');
  };

  return (
    <Screen header={<ScreenHeader title="Push Debug" onBack={() => navigation.goBack()} />}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <ScreenPad>
          <Spacer size="md" />
          <T.Meta color={colors.textSub}>
            Dev-only. Push tokens need a physical device and a build that includes expo-notifications.
          </T.Meta>
          <Spacer size="lg" />

          <Field label="Native push available" value={info ? (info.supported ? 'Yes' : 'No') : '…'} ok={info?.supported} />
          <Field label="Physical device" value={info ? (info.isDevice ? 'Yes' : 'No') : '…'} ok={info?.isDevice} />
          <Field label="Permission" value={info?.permission ?? '…'} ok={info?.permission === 'granted'} />
          <Field label="EAS projectId" value={info?.projectId ?? 'missing'} ok={!!info?.projectId} />
          {info?.error ? <Field label="Note" value={info.error} ok={false} /> : null}

          <Spacer size="lg" />
          <T.CapsSm color={colors.textSub}>EXPO PUSH TOKEN</T.CapsSm>
          <Spacer size="sm" />
          <Pressable
            onLongPress={onShare}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: borderWidths.thin,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <T.BodyMd color={info?.token ? colors.text : colors.textDim}>
              {info?.token ?? 'No token yet — tap “Fetch token” below on a real device.'}
            </T.BodyMd>
            {info?.token ? <T.MetaXs color={colors.textSub} style={{ marginTop: spacing.xs }}>Long-press to share / copy</T.MetaXs> : null}
          </Pressable>

          <Spacer size="lg" />
          <Button variant="primary" label={loading ? 'Fetching…' : 'Fetch token'} onPress={load} disabled={loading} />
          <Spacer size="sm" />
          <Button variant="secondary" label="Share token" onPress={onShare} disabled={!info?.token} />
          <Spacer size="sm" />
          <Button variant="secondary" label="Re-register with backend" onPress={onReRegister} disabled={!info?.token} />
        </ScreenPad>
      </ScrollView>
    </Screen>
  );
}
