import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { Row } from '@/components/layout/Row';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';

interface ReportFormProps {
  title: string;
  intro: string;
  reasons: string[];
  contextBlock?: React.ReactNode;
  onBack: () => void;
  onSubmit: () => void;
}

export function ReportForm({ title, intro, reasons, contextBlock, onBack, onSubmit }: ReportFormProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <Screen header={<ScreenHeader title={title} onBack={onBack} />}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        {contextBlock}
        <T.BodyLg color={colors.textSub} style={{ marginBottom: spacing.xl }}>{intro}</T.BodyLg>
        <Stack gap="sm" style={{ marginBottom: spacing.xl }}>
          {reasons.map((r) => {
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
                <T.Semibold
                  color={colors.text}
                  style={on ? undefined : { fontFamily: 'Inter-Medium' }}
                >
                  {r}
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
          label="Submit report"
          onPress={() => { toast.show('Report submitted'); onSubmit(); }}
          disabled={!selected}
        />
        <T.Meta style={{ textAlign: 'center', marginTop: spacing.md }}>
          Reports are confidential. The other party will not know you reported them.
        </T.Meta>
      </ScreenPad>
    </Screen>
  );
}
