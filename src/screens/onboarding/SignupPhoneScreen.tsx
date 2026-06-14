import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { PhoneInput } from '@/components/atoms/inputs/PhoneInput';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { sendOtp, phoneRegistered } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupPhone'>;

export function SignupPhoneScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [tcAccepted, setTcAccepted] = useState(false);
  const [sending, setSending] = useState(false);

  const phoneValid = phone.replace(/\D/g, '').length === 10;
  const canContinue = phoneValid && tcAccepted && !sending;

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={1} />
    </>
  );

  const onContinue = async () => {
    if (!phoneValid) { toast.show('Enter a valid 10-digit number'); return; }
    if (!tcAccepted) { toast.show('Accept the terms to continue'); return; }
    setSending(true);
    try {
      // Block an already-registered number before wasting an OTP. Stay on this
      // screen and surface the "Log in" link below instead of navigating away.
      if (await phoneRegistered(phone)) {
        toast.show('This number is already registered — log in instead.');
        return;
      }
      await sendOtp(phone);
      navigation.navigate('SignupOtp', { phone });
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t send the code. Try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>What's your number?</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>We'll send a one-time code to verify it's you. No spam, ever.</Text>
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          <PhoneInput value={phone} onChangeText={setPhone} autoFocus />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: radii.sm, marginBottom: 24, backgroundColor: colors.surface }}>
          <Pressable onPress={() => setTcAccepted((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: tcAccepted }} accessibilityLabel="Accept terms of service and privacy policy" hitSlop={8}>
            <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1, borderColor: tcAccepted ? colors.ctaBg : colors.borderMid, backgroundColor: tcAccepted ? colors.ctaBg : 'transparent' }}>
              {tcAccepted ? <Icon name="check" size={12} color={colors.ctaFg} strokeWidth={2.5} /> : null}
            </View>
          </Pressable>
          <Text style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 12 * 1.6, color: colors.textSub }}>
            I agree to hopon's{' '}
            <Text style={{ fontFamily: fontFamilies.semibold, color: colors.coral }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ fontFamily: fontFamilies.semibold, color: colors.coral }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
            . I confirm I am 18 years or older.
          </Text>
        </View>

        <Button variant="primary-coral" label={sending ? 'Sending…' : 'Send code'} onPress={onContinue} disabled={!canContinue} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, color: colors.textSub }}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} accessibilityRole="link" accessibilityLabel="Log in">
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.coral }}>Log in</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
