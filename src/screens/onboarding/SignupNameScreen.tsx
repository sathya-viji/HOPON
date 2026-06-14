import React, { useState, useEffect } from 'react';
import { View, Text, TextInput as RNTextInput } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii, letterSpacing } from '@/theme/tokens';
import { handleAvailable } from '@/api/auth';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupName'>;

type HandleStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';
const HANDLE_RE = /^[a-z0-9_.]{2,30}$/;

export function SignupNameScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { update } = useOnboardingDraft();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<HandleStatus>('idle');
  const [nameFocused, setNameFocused] = useState(false);
  const [handleFocused, setHandleFocused] = useState(false);

  // Debounced availability check whenever the handle changes.
  useEffect(() => {
    if (handle.length === 0) { setStatus('idle'); return; }
    if (!HANDLE_RE.test(handle)) { setStatus('invalid'); return; }
    setStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const free = await handleAvailable(handle);
        if (!cancelled) setStatus(free ? 'available' : 'taken');
      } catch {
        if (!cancelled) setStatus('idle');
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [handle]);

  const canContinue = name.trim().length > 0 && status === 'available';

  // status → border accent + helper text
  const handleBorder =
    status === 'available' ? colors.green
    : status === 'taken' || status === 'invalid' ? colors.coral
    : handleFocused ? colors.text : colors.border;

  const helper: { text: string; color: string } =
    status === 'available' ? { text: `@${handle} is available`, color: colors.green }
    : status === 'taken' ? { text: `@${handle} is taken — try another`, color: colors.coral }
    : status === 'invalid' ? { text: 'Use 2–30 letters, numbers, . or _', color: colors.coral }
    : status === 'checking' ? { text: 'Checking availability…', color: colors.textSub }
    : { text: 'Pick a username. You can change it later.', color: colors.textDim };

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={3} />
    </>
  );

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>What do people call you?</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
            Your name and handle are visible on your profile and plans.
          </Text>
        </View>

        <View style={{ gap: 14, marginBottom: 28 }}>
          <View>
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: letterSpacing.tags * 11, marginBottom: 8, color: colors.textSub }}>DISPLAY NAME</Text>
            <View style={{ borderWidth: 1.5, borderRadius: radii.sm, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.surface, borderColor: nameFocused ? colors.text : colors.border }}>
              <RNTextInput
                style={{ fontFamily: fontFamilies.medium, fontSize: 16, paddingVertical: 12, flex: 1, color: colors.text }}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Priya K"
                placeholderTextColor={colors.textDim}
                maxLength={32}
                autoFocus
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                returnKeyType="next"
              />
            </View>
          </View>

          <View>
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: letterSpacing.tags * 11, marginBottom: 8, color: colors.textSub }}>HANDLE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radii.sm, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.surface, borderColor: handleBorder }}>
              <Text style={{ fontFamily: fontFamilies.medium, fontSize: 16, marginRight: 4, color: colors.textDim }}>@</Text>
              <RNTextInput
                style={{ fontFamily: fontFamilies.medium, fontSize: 16, paddingVertical: 12, flex: 1, paddingLeft: 0, color: colors.text }}
                value={handle}
                onChangeText={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                placeholder="priya.blr"
                placeholderTextColor={colors.textDim}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setHandleFocused(true)}
                onBlur={() => setHandleFocused(false)}
              />
            </View>
            <Text style={{ fontFamily: fontFamilies.regular, fontSize: 11, marginTop: 6, color: helper.color }}>{helper.text}</Text>
          </View>
        </View>

        <Button
          variant="primary-coral"
          label="Continue"
          onPress={() => { update({ name: name.trim(), handle }); navigation.navigate('SignupDob'); }}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  );
}
