import React, { useState } from 'react';
import { View, Text, Modal, Platform } from 'react-native';
import { Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';
import type { OnboardingStackParamList } from '@/navigation/types';
import { MS_PER_YEAR } from '@/utils/time';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupDob'>;

const formatDob = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
// Local YYYY-MM-DD (avoids the UTC shift toISOString would introduce).
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function SignupDobScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const { update } = useOnboardingDraft();
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const age = dob ? Math.floor((Date.now() - dob.getTime()) / MS_PER_YEAR) : null;
  const tooYoung = age !== null && age < 18;
  const valid = age !== null && age >= 18;
  const borderColor = tooYoung ? colors.coral : valid ? colors.green : colors.border;

  const onChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDob(selected);
  };

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={4} />
    </>
  );

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>When were you born?</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
            hopon is for adults 18 and over. Your DOB is never shown publicly.
          </Text>
        </View>

        <Pressable
          onPress={() => setShowPicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: radii.sm, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderColor }}
          accessibilityRole="button"
          accessibilityLabel="Pick your date of birth"
        >
          <Text style={{ fontFamily: fontFamilies.medium, fontSize: 16, color: dob ? colors.text : colors.textDim }}>{dob ? formatDob(dob) : 'YYYY-MM-DD'}</Text>
          <Icon name="chevron-right" size={16} color={colors.textDim} />
        </Pressable>

        {age !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.sm, marginBottom: 24, backgroundColor: tooYoung ? colors.cost.sponsoredBg : colors.cost.freeBg }}>
            <Icon name={tooYoung ? 'alert-triangle' : 'circle-check'} size={16} color={tooYoung ? colors.cost.sponsoredFg : colors.cost.freeFg} />
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, flex: 1, color: tooYoung ? colors.cost.sponsoredFg : colors.cost.freeFg }}>
              {tooYoung ? `Age ${age} — you must be 18 or older to use hopon.` : `Age ${age} — welcome to hopon!`}
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 24 }} />
        )}

        <Button
          variant="primary-coral"
          label="Continue"
          onPress={() => { if (dob) update({ dob: isoDate(dob) }); navigation.navigate('SignupGender'); }}
          disabled={!valid}
        />
      </View>

      {showPicker && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible={showPicker} onRequestClose={() => setShowPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setShowPicker(false)}>
            <Pressable onPress={() => {}}>
              <View style={{ borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingTop: 0, paddingBottom: 32, alignItems: 'center', backgroundColor: colors.bg }}>
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderMid }} />
                </View>
                <DateTimePicker value={dob ?? new Date(2000, 0, 1)} mode="date" display="spinner" maximumDate={new Date()} onChange={onChange} themeVariant={mode === 'dark' ? 'dark' : 'light'} />
                <View style={{ paddingHorizontal: spacing.screenPx, paddingBottom: 16, alignSelf: 'stretch' }}>
                  <Button
                    variant="primary"
                    label="Done"
                    onPress={() => {
                      // Commit the spinner's resting value: onChange never fires
                      // when the user accepts the default without scrolling.
                      setDob((d) => d ?? new Date(2000, 0, 1));
                      setShowPicker(false);
                    }}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker value={dob ?? new Date(2000, 0, 1)} mode="date" display="default" maximumDate={new Date()} onChange={onChange} themeVariant={mode === 'dark' ? 'dark' : 'light'} />
      ) : null}
    </Screen>
  );
}
