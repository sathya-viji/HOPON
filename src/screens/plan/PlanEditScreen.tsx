import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import { FieldRow } from '@/components/atoms/inputs/FieldRow';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { updatePlan } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'PlanEdit'>;

export function PlanEditScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail } = usePlanDetail(planId);

  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [rules, setRules] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the form once the plan loads.
  useEffect(() => {
    if (detail && !hydrated) {
      setActivity(detail.plan.activity);
      setLocation(detail.plan.location);
      setRules(detail.plan.rules ?? '');
      setCoords({ lat: detail.plan.lat, lng: detail.plan.lng });
      setHydrated(true);
    }
  }, [detail, hydrated]);

  // A re-picked location (from LocSearch) overrides.
  useEffect(() => {
    if (route.params?.location) setLocation(route.params.location);
    if (route.params?.lat != null && route.params?.lng != null) {
      setCoords({ lat: route.params.lat, lng: route.params.lng });
    }
  }, [route.params?.location, route.params?.lat, route.params?.lng]);

  if (!detail) {
    return (
      <Screen scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  const plan = detail.plan;

  const onSave = async () => {
    if (saving) return;
    if (!planId || !coords) { toast.show('Pick a location'); return; }
    if (!activity.trim()) { toast.show('Add an activity name'); return; }
    setSaving(true);
    try {
      // Capacity is intentionally not editable. Unedited fields (start time,
      // cost, who-can-join, description) are passed through unchanged.
      await updatePlan({
        planId,
        activity: activity.trim(),
        locationLabel: location.trim(),
        lat: coords.lat,
        lng: coords.lng,
        startsAt: plan.startsAt,
        cost: plan.cost,
        genderPref: plan.genderPref,
        costNote: plan.costNote,
        description: plan.description,
        rules: rules.trim() || undefined,
      });
      toast.show('Plan updated');
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      toast.show(errorMessage(e, 'Couldn’t save changes. Try again.'));
    }
  };

  return (
    <Screen header={<ScreenHeader title="Edit plan" onBack={() => navigation.goBack()} />}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        <Stack gap="sm">
          <Stack gap="sm">
            <T.CapsSm>Activity</T.CapsSm>
            <TextInput placeholder="Activity name" value={activity} onChangeText={setActivity} maxLength={60} />
          </Stack>
          <FieldRow icon="map-pin" label="LOCATION" value={location} onPress={() => navigation.navigate('LocSearch', { returnTo: 'PlanEdit' })} selected />
          <Stack gap="sm">
            <T.CapsSm>Rules (Optional)</T.CapsSm>
            <TextInput placeholder="Anything joiners should know?" value={rules} onChangeText={setRules} maxLength={140} multiline />
          </Stack>
          <View style={{ marginTop: spacing.xl }}>
            <Button variant="primary-coral" label={saving ? 'Saving…' : 'Save changes'} onPress={onSave} disabled={saving} />
          </View>
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
