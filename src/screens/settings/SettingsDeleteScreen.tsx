import React, { useState } from 'react';
import { View, Share } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { Row } from '@/components/layout/Row';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { IconBox } from '@/components/atoms/IconBox';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { deleteAccount, exportMyData } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/state/AuthContext';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsDelete'>;

const ITEMS = [
  'Your profile and photo',
  'All plans you hosted',
  'Your recaps and moments',
  'Your Familiar Faces graph',
  'All messages',
];

export function SettingsDeleteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { refresh } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const confirmed = confirm.trim().toUpperCase() === 'DELETE' && !deleting;

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportMyData();
      await Share.share({
        title: 'My HopOn data',
        message: JSON.stringify(data, null, 2),
      });
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t prepare your data. Try again.'));
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();   // soft-delete + sign out
      await refresh();         // auth gate → onboarding
      toast.show('Account deleted');
    } catch (e) {
      setDeleting(false);
      toast.show(errorMessage(e, 'Couldn’t delete the account. Try again.'));
    }
  };

  return (
    <Screen header={<ScreenHeader title="Delete account" onBack={() => navigation.goBack()} />}>
      <ScreenPad style={{ flex: 1, paddingVertical: spacing.xxl, alignItems: 'center' }}>
        <IconBox backgroundColor={colors.cost.sponsoredBg}>
          <Icon name="x-circle" size={iconSizes.xl} color={colors.cost.sponsoredFg} />
        </IconBox>
        <T.Heading style={{ marginBottom: spacing.sm, textAlign: 'center' }}>Delete your account?</T.Heading>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 280, marginBottom: spacing.lg }}>
          Your account is deactivated right away and permanently deleted after a{' '}
          <T.Bold color={colors.text}>30-day grace period</T.Bold>. Download your data first if you'd like a copy.
        </T.BodyLg>

        <Pressable
          onPress={doExport}
          disabled={exporting}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: radii.xl, borderWidth: borderWidths.medium, borderColor: colors.border, marginBottom: spacing.xxl, opacity: exporting ? 0.6 : 1 }}
        >
          <Icon name="share-2" size={iconSizes.sm} color={colors.text} />
          <T.LabelMd>{exporting ? 'Preparing…' : 'Download my data'}</T.LabelMd>
        </Pressable>

        <View style={{ width: '100%', padding: spacing.lg, borderRadius: radii.lg, borderWidth: borderWidths.thin, backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.xxl }}>
          {ITEMS.map((item) => (
            <Row key={item} gap="sm" style={{ paddingVertical: 5 }}>
              <Icon name="x" size={iconSizes.xs} color={colors.cost.sponsoredFg} strokeWidth={2.5} />
              <T.BodyMd color={colors.textSub}>{item}</T.BodyMd>
            </Row>
          ))}
        </View>

        <View style={{ width: '100%', marginBottom: spacing.lg }}>
          <T.LabelMd color={colors.textSub} style={{ marginBottom: spacing.sm }}>
            Type <T.Bold color={colors.text}>DELETE</T.Bold> to confirm
          </T.LabelMd>
          <TextInput value={confirm} onChangeText={setConfirm} placeholder="DELETE" maxLength={6} />
        </View>

        <Stack gap="sm" style={{ width: '100%' }}>
          <Pressable
            onPress={confirmed ? doDelete : undefined}
            disabled={!confirmed}
            accessibilityRole="button"
            accessibilityLabel="Delete my account forever"
            style={{ width: '100%', paddingVertical: spacing.lg, borderRadius: radii.xl, alignItems: 'center', backgroundColor: confirmed ? colors.cost.sponsoredFg : colors.surfaceMid }}
          >
            <T.LabelLg color={confirmed ? colors.white : colors.textDim}>Delete my account forever</T.LabelLg>
          </Pressable>
          <Button variant="secondary" label="Cancel" onPress={() => navigation.goBack()} />
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
