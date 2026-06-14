import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Pressable } from 'react-native';
import * as Location from 'expo-location';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii, letterSpacing } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/state/AuthContext';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';
import { completeSignup, setInterests, hasProfile } from '@/api/auth';
import { errorMessage, errorCode } from '@/api/errors';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'Neighbourhood'>;

const AREAS = ['HSR Layout', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield', 'Marathahalli', 'Electronic City', 'JP Nagar'];

// Bounds the "Setting up…" spinner so a hung request surfaces an actionable
// error instead of waiting on the OS-level socket timeout. Generous on purpose —
// it should only fire on a true network hang, not a merely-slow connection.
const SIGNUP_TIMEOUT_MS = 20000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export function NeighbourhoodScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { refresh } = useAuth();
  const { draft } = useOnboardingDraft();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const useLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.show('Location access denied — pick manually'); return; }
      setSelected('HSR Layout');
      toast.show('Located you in HSR Layout');
    } catch { toast.show('Could not get location — pick manually'); }
  };

  const finishOnboarding = async () => {
    if (!selected) { toast.show('Pick your neighbourhood'); return; }
    if (!draft.name || !draft.handle || !draft.dob || !draft.gender) {
      toast.show('Please complete the earlier steps');
      return;
    }
    setSubmitting(true);
    try {
      // complete_signup is idempotent server-side (a retry returns the existing
      // profile), so a dropped/timed-out response can't create a duplicate or
      // re-fire the welcome/contact_joined notifications. The timeout only bounds
      // the spinner on a hung request.
      await withTimeout(
        completeSignup({
          name: draft.name,
          handle: '@' + draft.handle,
          dob: draft.dob,
          gender: draft.gender,
          neighbourhood: selected,
        }),
        SIGNUP_TIMEOUT_MS,
      );
      if (draft.interests.length > 0) {
        try { await setInterests(draft.interests); } catch { /* non-blocking */ }
      }
      await refresh();   // profile exists → auth gate switches to Main
    } catch (e) {
      // The write may have landed even though the response didn't (connection
      // dropped/timed out after the insert). complete_signup is idempotent, so
      // check whether the profile now exists and advance — don't show a false
      // failure on what was actually a success.
      try {
        if (await hasProfile()) { await refresh(); return; }
      } catch { /* still offline — fall through to the error below */ }
      setSubmitting(false);
      // A genuine handle collision (someone took it between the live check and
      // now): go back to the name step (kept mounted, so entries persist).
      if (errorCode(e) === 'handle_taken') {
        toast.show('That username was just taken — pick another.');
        navigation.navigate('SignupName');
        return;
      }
      // Network / timeout / other: values are preserved on this screen (and the
      // earlier steps), so a retry needs no re-entry.
      toast.show(errorMessage(e, 'Couldn’t finish setup — your details are saved, try again.'));
    }
  };

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => navigation.goBack()} />
    </View>
  );

  const footer = (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: 1, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button variant="primary-coral" label={submitting ? 'Setting up…' : 'Start exploring →'} onPress={finishOnboarding} disabled={!selected || submitting} />
    </View>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: 24, paddingBottom: 16 }}>
        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 6, color: colors.text }}>Where are you based?</Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.5, color: colors.textSub }}>
          We'll show you plans in your area first. You can change this anytime.
        </Text>
      </View>

      <View style={{ marginHorizontal: spacing.screenPx, marginBottom: 20, padding: 16, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderColor: colors.border }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cost.freeBg }}>
          <Icon name="crosshair" size={22} color={colors.cost.freeFg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14, marginBottom: 2, color: colors.text }}>Use my location</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 12, color: colors.textSub }}>Automatically find your neighbourhood</Text>
        </View>
        <Pressable onPress={useLocation} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.sm, backgroundColor: colors.ctaBg }} accessibilityRole="button" accessibilityLabel="Allow location">
          <Text style={{ fontFamily: fontFamilies.bold, fontSize: 12, color: colors.ctaFg }}>Allow</Text>
        </Pressable>
      </View>

      <Text style={{ fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: letterSpacing.sectionHeader * 10, paddingHorizontal: spacing.screenPx, marginBottom: 10, color: colors.textSub }}>OR CHOOSE MANUALLY</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {AREAS.map((area) => {
          const on = selected === area;
          return (
            <Pressable
              key={area}
              onPress={() => setSelected(area)}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.surface, backgroundColor: on ? colors.surface : 'transparent' },
                on ? { borderLeftWidth: 3, borderLeftColor: colors.text, paddingLeft: 13 } : null,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={area}
            >
              <Icon name="map-pin" size={18} color={on ? colors.text : colors.textDim} />
              <Text style={{ fontSize: 15, flex: 1, color: colors.text, fontFamily: on ? fontFamilies.bold : fontFamilies.medium }}>{area}</Text>
              {on ? <Icon name="check" size={16} color={colors.text} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
