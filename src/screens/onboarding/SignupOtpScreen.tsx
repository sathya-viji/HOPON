import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { OtpInput } from '@/components/atoms/inputs/OtpInput';
import { useTheme } from '@/theme';
import { spacing, fontFamilies } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { verifyOtp, sendOtp, hasProfile, signOut } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupOtp'>;

// Matches config.toml [auth.sms] max_frequency = "2m0s" — the server rejects an
// earlier resend, so the button counts down before it re-enables.
const RESEND_COOLDOWN_SEC = 120;

export function SignupOtpScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  // A code was just sent on the previous screen, so start in cooldown.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const phone = route.params?.phone ?? '98xxx xxxxx';

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={2} />
    </>
  );

  const handleVerify = async (code?: string) => {
    const v = code ?? otp;
    if (v.length < 6) { toast.show('Enter the 6-digit code'); return; }
    if (verifying) return;
    setVerifying(true);
    try {
      await verifyOtp(phone, v);
      // This is the SIGN-UP flow: an existing, completed account means the number
      // is already registered → reject and send them to log in instead of
      // creating/entering the account.
      if (await hasProfile()) {
        await signOut();
        toast.show('This number is already registered. Please log in.');
        navigation.navigate('Login');
      } else {
        navigation.navigate('SignupName');
      }
    } catch (e) {
      setOtp('');
      toast.show(errorMessage(e, 'That code didn’t work. Try again.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOtp(phone);
      setCooldown(RESEND_COOLDOWN_SEC);
      toast.show('Code resent');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t resend the code.'));
    }
  };

  const footer = (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: 1, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button variant="primary-coral" label={verifying ? 'Verifying…' : 'Verify number'} onPress={() => handleVerify()} disabled={otp.length < 6 || verifying} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md }}>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 13, color: colors.textSub }}>Didn't get it? </Text>
        <Pressable onPress={handleResend} disabled={cooldown > 0} hitSlop={8} accessibilityRole="link" accessibilityState={{ disabled: cooldown > 0 }}>
          <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: cooldown > 0 ? colors.textDim : colors.coral }}>
            {cooldown > 0 ? `Resend in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen header={header} footer={footer} keyboardAware={false}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>Enter the code.</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
            Sent to <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>+91 {phone}</Text>. Takes a few seconds.
          </Text>
        </View>

        <View style={{ marginBottom: 28 }}>
          <OtpInput value={otp} onChangeText={(v) => { setOtp(v); if (v.length >= 6) handleVerify(v); }} autoFocus />
        </View>

      </View>
    </Screen>
  );
}
