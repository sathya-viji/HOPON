import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme';
import { spacing, fontFamilies } from '@/theme/tokens';
import { Button } from '@/components/atoms/Button';
import { PhoneInput } from '@/components/atoms/inputs/PhoneInput';
import { OtpInput } from '@/components/atoms/inputs/OtpInput';
import { useToast } from '@/hooks/useToast';
import { sendOtp, verifyOtp, hasProfile, phoneRegistered } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/state/AuthContext';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { refresh } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => (step === 2 ? setStep(1) : navigation.goBack())} />
    </View>
  );

  const onSendCode = async () => {
    if (phone.replace(/\D/g, '').length < 10) { toast.show('Enter a valid phone number'); return; }
    setSending(true);
    try {
      // No account on this number → stay put and surface the "Create account"
      // link below, instead of navigating away.
      if (!(await phoneRegistered(phone))) {
        toast.show('No account found — create one instead.');
        return;
      }
      await sendOtp(phone);
      setStep(2);
      setOtp('');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t send the code. Try again.'));
    } finally {
      setSending(false);
    }
  };

  const onVerify = async (code?: string) => {
    const value = code ?? otp;
    if (value.length < 6) { toast.show('Enter the 6-digit code'); return; }
    if (verifying) return;
    setVerifying(true);
    try {
      await verifyOtp(phone, value);
      // Has profile → the auth gate swaps to Main. No account on this verified
      // number → tell them and continue into onboarding (they're already
      // verified, so no need to re-enter the number).
      if (await hasProfile()) {
        await refresh();
      } else {
        toast.show('No account found — let’s set one up.');
        navigation.navigate('SignupName');
      }
    } catch (e) {
      setOtp('');
      toast.show(errorMessage(e, 'That code didn’t work. Try again.'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 32, paddingBottom: 40 }}>
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>
            {step === 1 ? 'Welcome back.' : 'Enter your code.'}
          </Text>
          {step === 1 ? (
            <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>Sign in with your phone number.</Text>
          ) : (
            <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
              We sent a 6-digit code to{' '}
              <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>+91 {phone || '98xxx xxxxx'}</Text>
            </Text>
          )}
        </View>

        {step === 1 ? (
          <>
            <View style={{ marginBottom: spacing.xl }}>
              <PhoneInput label="PHONE NUMBER" value={phone} onChangeText={setPhone} autoFocus />
            </View>
            <View style={{ marginBottom: 16 }}>
              <Button variant="primary-coral" label={sending ? 'Sending…' : 'Send code'} onPress={onSendCode} disabled={sending} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg }}>
              <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, color: colors.textSub }}>New to hopon? </Text>
              <Pressable onPress={() => navigation.navigate('SignupPhone')} hitSlop={8} accessibilityRole="link" accessibilityLabel="Create account">
                <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.coral }}>Create account</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={{ marginBottom: spacing.xxl }}>
              <Text style={{ fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 0.06 * 11, marginBottom: 8, color: colors.textSub }}>VERIFICATION CODE</Text>
              <OtpInput value={otp} onChangeText={(v) => { setOtp(v); if (v.length >= 6) onVerify(v); }} autoFocus />
            </View>
            <Button variant="primary-coral" label={verifying ? 'Verifying…' : 'Verify & sign in'} onPress={() => onVerify()} disabled={verifying} />
            <Pressable onPress={() => setStep(1)} style={{ alignSelf: 'center', marginTop: spacing.lg, padding: spacing.xs }} hitSlop={8} accessibilityRole="link" accessibilityLabel="Change number">
              <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.coral }}>← Change number</Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}
