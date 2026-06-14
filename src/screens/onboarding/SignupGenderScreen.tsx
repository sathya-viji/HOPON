import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { useOnboardingDraft, type Gender } from '@/state/OnboardingDraftContext';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupGender'>;

// `val` is the BACKEND gender_t value (man/woman/…); labels stay user-facing.
const OPTS: { val: Gender; label: string; sub: string }[] = [
  { val: 'man', label: 'Male', sub: 'He/him' },
  { val: 'woman', label: 'Female', sub: 'She/her' },
  { val: 'nonbinary', label: 'Non-binary', sub: 'They/them' },
  { val: 'prefer_not', label: 'Prefer not to say', sub: 'Private' },
];

export function SignupGenderScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { update } = useOnboardingDraft();
  const [sel, setSel] = useState<Gender | null>(null);

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={5} />
    </>
  );

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>How do you identify?</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
            Used to match you with plans that have a gender preference. Shown on your profile.
          </Text>
        </View>

        <View style={{ gap: 10, marginBottom: 28 }}>
          {OPTS.map((o) => {
            const selected = sel === o.val;
            return (
              <Pressable
                key={o.val}
                onPress={() => setSel(o.val)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: radii.sm, backgroundColor: selected ? colors.surfaceMid : colors.surface, borderColor: selected ? colors.text : colors.border }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={o.label}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: selected ? colors.text : colors.borderMid }}>
                  {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text }} /> : null}
                </View>
                <View>
                  <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 15, color: colors.text }}>{o.label}</Text>
                  <Text style={{ fontFamily: fontFamilies.regular, fontSize: 12, marginTop: 2, color: colors.textSub }}>{o.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button
          variant="primary-coral"
          label="Continue"
          onPress={() => { if (sel) update({ gender: sel }); navigation.navigate('SignupPhoto'); }}
          disabled={!sel}
        />
      </View>
    </Screen>
  );
}
