import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native';
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
import { errorMessage } from '@/api/errors';
import type { ReportReasonValue } from '@/api/safety';

export interface ReportReasonOption {
  label: string;
  value: ReportReasonValue;
}

interface ReportFormProps {
  title: string;
  intro: string;
  reasons: ReportReasonOption[];
  contextBlock?: React.ReactNode;
  onBack: () => void;
  /** Perform the actual submit_report call. Throws on failure (e.g. rate_limited). */
  submit: (reason: ReportReasonValue, notes: string) => Promise<void>;
  /** Called after a successful submit (typically navigation.goBack). */
  onDone: () => void;
}

export function ReportForm({ title, intro, reasons, contextBlock, onBack, submit, onDone }: ReportFormProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState<ReportReasonOption | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await submit(selected.value, notes.trim());
      toast.show('Report submitted — thank you');
      onDone();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t submit report. Try again.'));
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title={title} onBack={onBack} />}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        {contextBlock}
        <T.BodyLg color={colors.textSub} style={{ marginBottom: spacing.xl }}>{intro}</T.BodyLg>
        <Stack gap="sm" style={{ marginBottom: spacing.xl }}>
          {reasons.map((r) => {
            const on = selected?.label === r.label;
            return (
              <Pressable
                key={r.label}
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
                <T.Semibold color={colors.text} style={on ? undefined : { fontFamily: 'Inter-Medium' }}>
                  {r.label}
                </T.Semibold>
              </Pressable>
            );
          })}
        </Stack>
        <View style={{ marginBottom: spacing.xl }}>
          <T.CapsSm style={{ marginBottom: spacing.sm }}>Additional Details (Optional)</T.CapsSm>
          <TextInput placeholder="Describe what happened…" value={notes} onChangeText={setNotes} maxLength={500} multiline />
        </View>
        <Button
          variant="primary-coral"
          label={busy ? 'Submitting…' : 'Submit report'}
          onPress={onSubmit}
          disabled={!selected || busy}
        />
        <T.Meta style={{ textAlign: 'center', marginTop: spacing.md }}>
          Reports are confidential. The other party will not know you reported them.
        </T.Meta>
      </ScreenPad>
    </Screen>
  );
}
