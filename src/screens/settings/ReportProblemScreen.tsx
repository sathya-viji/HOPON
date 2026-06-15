import React, { useState } from 'react';
import { View, Linking } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ReportProblem'>;

// App feedback / bug reports have no in-app backend (documented gap G3) — they
// go to support over email. This screen composes a mailto so the user's mail
// client handles delivery.
const SUPPORT_EMAIL = 'support@hopon.app';
const REASONS = ["Something doesn't work", 'I have a suggestion', 'I saw a bug', 'Something else'];

export function ReportProblemScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const send = async () => {
    const subject = encodeURIComponent(`HopOn feedback: ${selected ?? 'General'}`);
    const body = encodeURIComponent(notes.trim() || '');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) { await Linking.openURL(url); navigation.goBack(); }
      else { toast.show(`Email us at ${SUPPORT_EMAIL}`); }
    } catch {
      toast.show(`Email us at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <Screen header={<ScreenHeader title="Report a problem" onBack={() => navigation.goBack()} />}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        <T.BodyLg color={colors.textSub} style={{ marginBottom: spacing.xl }}>
          Tell us what's wrong and we'll follow up over email. We read every message.
        </T.BodyLg>
        <Stack gap="sm" style={{ marginBottom: spacing.xl }}>
          {REASONS.map((r) => {
            const on = selected === r;
            return (
              <Pressable
                key={r}
                onPress={() => setSelected(r)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingVertical: 13, paddingHorizontal: spacing.lg,
                  borderRadius: radii.sm, borderWidth: borderWidths.medium,
                  backgroundColor: on ? colors.surfaceMid : colors.surface,
                  borderColor: on ? colors.text : colors.border,
                }}
              >
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: borderWidths.thick, borderColor: on ? colors.text : colors.borderMid, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.text }} /> : null}
                </View>
                <T.Semibold color={colors.text} style={on ? undefined : { fontFamily: 'Inter-Medium' }}>{r}</T.Semibold>
              </Pressable>
            );
          })}
        </Stack>
        <View style={{ marginBottom: spacing.xl }}>
          <T.CapsSm style={{ marginBottom: spacing.sm }}>Details (Optional)</T.CapsSm>
          <TextInput placeholder="Describe what happened…" value={notes} onChangeText={setNotes} maxLength={500} multiline />
        </View>
        <Button variant="primary-coral" label="Email support" onPress={send} disabled={!selected} />
      </ScreenPad>
    </Screen>
  );
}
