import React, { useState, useEffect } from 'react';
import { View, ScrollView, Platform, Pressable } from 'react-native';
import { TextInput as RNTextInput } from 'react-native-gesture-handler';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon, IconName } from '@/components/atoms/Icon';
import { FieldRow } from '@/components/atoms/inputs/FieldRow';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, fontFamilies, CATEGORIES, CATEGORY_PRESETS } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { createPlan } from '@/api/plans';
import { errorMessage } from '@/api/errors';
import type { HomeStackParamList } from '@/navigation/types';
import { MAX_PLAN_LOOKAHEAD_MS } from '@/constants/plan';

type Props = StackScreenProps<HomeStackParamList, 'Create'>;
type CostId = 'free' | 'copay' | 'seeking' | 'sponsored';
type GenderId = 'all' | 'women' | 'men';
type PickerMode = 'date' | 'time';

// Server caps the start at +14 days (starts_too_far); mirror it in the picker.
const MAX_START = () => new Date(Date.now() + MAX_PLAN_LOOKAHEAD_MS);

const COST_OPTS: { id: CostId; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'copay', label: 'Co-pay' },
  { id: 'seeking', label: 'Seeking sponsor' },
  { id: 'sponsored', label: 'Sponsored' },
];

const WHO_OPTS: { id: GenderId; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'women', label: 'Women only' },
  { id: 'men', label: 'Men only' },
];

function formatDate(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function defaultWhen(): Date {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export function CreateScreen({ navigation, route }: Props) {
  const { colors, mode } = useTheme();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState<Date>(defaultWhen);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [spots, setSpots] = useState(4);
  const [cost, setCost] = useState<CostId>('free');
  const [planType, setPlanType] = useState<'open' | 'closed'>('open');
  const [genderPref, setGenderPref] = useState<GenderId>('all');
  const [rules, setRules] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const picked = route.params?.location;
    if (picked) setLocation(picked);
    if (route.params?.lat != null && route.params?.lng != null) {
      setCoords({ lat: route.params.lat, lng: route.params.lng });
    }
  }, [route.params?.location, route.params?.lat, route.params?.lng]);

  const submit = async () => {
    if (submitting) return;
    if (!categoryId || !activity.trim() || !location.trim()) { toast.show('Complete the plan details'); return; }
    if (!coords) { toast.show('Pick a location from the list'); return; }
    setSubmitting(true);
    try {
      const plan = await createPlan({
        categoryId,
        activity: activity.trim(),
        locationLabel: location.trim(),
        lat: coords.lat,
        lng: coords.lng,
        startsAt: when.toISOString(),
        capacity: spots,            // includes the host (joinable = spots − 1)
        planType,
        cost,
        genderPref,
        rules: rules.trim() || undefined,
      });
      navigation.replace('PlanPosted', { planId: plan.id, locationLabel: plan.location });
    } catch (e) {
      setSubmitting(false);
      toast.show(errorMessage(e, 'Couldn’t post the plan. Try again.'));
    }
  };

  const goNext = () => {
    if (step === 1) {
      if (!categoryId) { toast.show('Pick a category'); return; }
      if (!activity.trim()) { toast.show('Add an activity name'); return; }
      const preset = CATEGORY_PRESETS[categoryId];
      if (preset) { setSpots(preset.spots); setCost(preset.cost as CostId); }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      submit();
    }
  };

  const goBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((step - 1) as 1 | 2 | 3);
  };

  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const step1CanContinue = !!categoryId && activity.trim().length > 0;
  const step2CanContinue = location.trim().length > 0;

  const header = (
    <ScreenPad style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.xs }}>
      <Row gap="sm" style={{ marginBottom: spacing.sm }}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? colors.ctaBg : colors.border }} />
        ))}
      </Row>
      <Row gap="md">
        <Stack style={{ flex: 1 }}>
          <T.LabelLg>{step === 1 ? "What's the plan?" : step === 2 ? 'Details' : 'Review & post'}</T.LabelLg>
          <T.MetaXs>Step {step} of 3</T.MetaXs>
        </Stack>
        <Pressable onPress={goBack} hitSlop={spacing.sm} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
          <Icon name="x" size={iconSizes.sm} color={colors.textSub} />
        </Pressable>
      </Row>
    </ScreenPad>
  );

  const footer = (
    <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      {step === 1 ? (
        <Button variant="primary-coral" label="Next → Details" onPress={goNext} disabled={!step1CanContinue} />
      ) : step === 2 ? (
        <Row gap="sm">
          <Pressable
            onPress={goBack}
            style={{ paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: borderWidths.medium, alignItems: 'center', justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <T.Semibold color={colors.textSub}>← Back</T.Semibold>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button variant="primary-coral" label="Review plan →" onPress={goNext} disabled={!step2CanContinue} />
          </View>
        </Row>
      ) : (
        <Button variant="primary-coral" label={submitting ? 'Posting…' : 'Post plan →'} onPress={goNext} disabled={submitting} />
      )}
    </ScreenPad>
  );

  return (
    <Screen header={header} footer={footer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <ScreenPad style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            {/* Category grid */}
            <Row wrap gap="sm">
              {CATEGORIES.map((c) => {
                const on = categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={{ width: '23%', height: 80, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.xs, borderRadius: radii.sm, borderWidth: borderWidths.medium, backgroundColor: on ? c.bg : colors.surface, borderColor: on ? colors.text : colors.border }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={c.label}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
                      <Icon name={c.icon as IconName} size={18} color={c.iconColor} strokeWidth={2} />
                    </View>
                    <T.LabelXs color={on ? c.iconColor : colors.textSub} style={{ textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>{c.label}</T.LabelXs>
                  </Pressable>
                );
              })}
            </Row>

            {/* Activity name */}
            <Stack gap="sm" style={{ marginTop: spacing.md }}>
              <T.CapsSm>What exactly?</T.CapsSm>
              <View style={{ borderWidth: borderWidths.medium, borderRadius: radii.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.md, backgroundColor: categoryId ? colors.bg : colors.surface, borderColor: colors.border }}>
                <RNTextInput
                  style={{ fontFamily: fontFamilies.medium, fontSize: 15, color: colors.text }}
                  placeholder={cat ? `e.g. Doubles at ${cat.label}` : 'Pick a category first…'}
                  placeholderTextColor={colors.textDim}
                  value={activity}
                  onChangeText={setActivity}
                  maxLength={60}
                  editable={!!categoryId}
                />
              </View>
              <T.MetaXs style={{ textAlign: 'right' }}>{activity.length}/60</T.MetaXs>
            </Stack>
          </ScreenPad>
        ) : step === 2 ? (
          <ScreenPad style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
            <Stack gap="sm">
              {/* Location */}
              <FieldRow icon="map-pin" label="LOCATION" placeholder="Where is this?" value={location || undefined} onPress={() => navigation.navigate('LocSearch', { returnTo: 'Create' })} selected={!!location} />

              {/* When */}
              <Stack gap="sm">
                <T.CapsSm>When</T.CapsSm>
                <Row gap="sm">
                  {(['date', 'time'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setPickerMode(m)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1, paddingVertical: 11, paddingHorizontal: spacing.md - 2, borderRadius: radii.sm, borderWidth: borderWidths.medium, backgroundColor: colors.surface, borderColor: pickerMode === m ? colors.text : colors.border }}
                    >
                      <Icon name={m === 'date' ? 'calendar' : 'clock'} size={iconSizes.xs} color={colors.textSub} />
                      <T.Semibold>{m === 'date' ? formatDate(when) : formatTime(when)}</T.Semibold>
                    </Pressable>
                  ))}
                </Row>
                {pickerMode !== null ? (
                  <View style={{ alignItems: 'center' }}>
                    <DateTimePicker
                      value={when}
                      mode={pickerMode}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      maximumDate={MAX_START()}
                      themeVariant={mode === 'dark' ? 'dark' : 'light'}
                      onChange={(e: DateTimePickerEvent, selected?: Date) => {
                        if (Platform.OS === 'android') setPickerMode(null);
                        if (selected) setWhen(selected);
                      }}
                    />
                  </View>
                ) : null}
              </Stack>

              {/* Spots stepper */}
              <Row gap="md" style={{ padding: spacing.md - 2, paddingHorizontal: spacing.sm + 2, borderRadius: radii.sm, borderWidth: borderWidths.thin, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Stack style={{ flex: 1 }}>
                  <T.CapsSm>Spots available</T.CapsSm>
                  <T.MetaXs>Including you</T.MetaXs>
                </Stack>
                <Row gap="sm" align="center">
                  <Pressable
                    onPress={() => setSpots((s) => Math.max(2, s - 1))}
                    style={{ width: 32, height: 32, borderRadius: radii.xs, borderWidth: borderWidths.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderColor: colors.border, opacity: spots <= 2 ? 0.3 : 1 }}
                  >
                    <T.LabelLg>−</T.LabelLg>
                  </Pressable>
                  <T.StatNum style={{ minWidth: 24, textAlign: 'center' }}>{spots}</T.StatNum>
                  <Pressable
                    onPress={() => setSpots((s) => Math.min(10, s + 1))}
                    style={{ width: 32, height: 32, borderRadius: radii.xs, borderWidth: borderWidths.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg, borderColor: colors.ctaBg, opacity: spots >= 10 ? 0.3 : 1 }}
                  >
                    <T.LabelLg color={colors.ctaFg}>+</T.LabelLg>
                  </Pressable>
                </Row>
              </Row>

              {/* Cost */}
              <Stack gap="sm">
                <T.CapsSm>Cost</T.CapsSm>
                <Row wrap gap="sm">
                  {COST_OPTS.map((o) => {
                    const on = cost === o.id;
                    return (
                      <Pressable key={o.id} onPress={() => setCost(o.id)} style={{ flex: 1, minWidth: '45%', paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radii.sm, borderWidth: borderWidths.medium, backgroundColor: on ? colors.ctaBg : colors.surface, borderColor: on ? colors.ctaBg : colors.border }}>
                        <T.LabelXs color={on ? colors.ctaFg : colors.textSub}>{o.label}</T.LabelXs>
                      </Pressable>
                    );
                  })}
                </Row>
              </Stack>

              {/* Who can join */}
              <Stack gap="sm">
                <T.CapsSm>Who can join</T.CapsSm>
                <Row gap="sm">
                  {WHO_OPTS.map((o) => {
                    const on = genderPref === o.id;
                    return (
                      <Pressable key={o.id} onPress={() => setGenderPref(o.id)} style={{ flex: 1, paddingVertical: 9, paddingHorizontal: spacing.xs, borderRadius: radii.sm, borderWidth: borderWidths.medium, alignItems: 'center', backgroundColor: on ? colors.ctaBg : colors.surface, borderColor: on ? colors.ctaBg : colors.border }}>
                        <T.LabelXs color={on ? colors.ctaFg : colors.textSub}>{o.label}</T.LabelXs>
                      </Pressable>
                    );
                  })}
                </Row>
              </Stack>

              {/* Plan type */}
              <Stack gap="sm">
                <T.CapsSm>Plan type</T.CapsSm>
                <Row gap="sm">
                  {(['open', 'closed'] as const).map((t) => {
                    const on = planType === t;
                    return (
                      <Pressable key={t} onPress={() => setPlanType(t)} style={{ flex: 1, padding: spacing.md - 2, borderRadius: radii.sm, borderWidth: borderWidths.medium, backgroundColor: on ? colors.surfaceMid : colors.surface, borderColor: on ? colors.text : colors.border }}>
                        <Row gap="sm" style={{ marginBottom: 3 }}>
                          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: on ? colors.text : colors.borderMid }}>
                            {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text }} /> : null}
                          </View>
                          <T.LabelSm>{t === 'open' ? 'Open' : 'Closed'}</T.LabelSm>
                        </Row>
                        <T.MetaXs style={{ paddingLeft: 24 }}>{t === 'open' ? 'Anyone joins instantly' : 'You approve each request'}</T.MetaXs>
                      </Pressable>
                    );
                  })}
                </Row>
              </Stack>

              {/* Rules */}
              <Stack gap="sm" style={{ paddingBottom: spacing.xs }}>
                <T.CapsSm>About this plan <T.Meta>(optional)</T.Meta></T.CapsSm>
                <RNTextInput
                  style={{ borderWidth: borderWidths.medium, borderRadius: radii.sm, padding: spacing.sm + 2, paddingHorizontal: spacing.md - 2, fontSize: 13, fontFamily: fontFamilies.regular, lineHeight: 13 * 1.5, minHeight: 70, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }}
                  placeholder="e.g. Bring your own racquet. Intermediate level only."
                  placeholderTextColor={colors.textDim}
                  value={rules}
                  onChangeText={setRules}
                  maxLength={140}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </Stack>
            </Stack>
          </ScreenPad>
        ) : (
          /* Step 3 — Review */
          <ScreenPad style={{ paddingTop: spacing.md }}>
            <Stack style={{ borderRadius: radii.lg, borderWidth: borderWidths.thin, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <Row gap="md" style={{ padding: spacing.sm + 2, paddingHorizontal: spacing.md, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <Stack style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: cat?.bg ?? colors.surfaceMid }}>
                  <Icon name={(cat?.icon ?? 'sparkles') as IconName} size={20} color={cat?.iconColor ?? colors.textSub} strokeWidth={2} />
                </Stack>
                <Stack style={{ flex: 1 }}>
                  <T.LabelLg numberOfLines={1}>{activity}</T.LabelLg>
                  <T.MetaXs numberOfLines={1}>{location || 'Add location'}</T.MetaXs>
                </Stack>
              </Row>
              <Row wrap gap="sm" style={{ padding: spacing.md - 2, paddingHorizontal: spacing.md }}>
                {[
                  `${formatDate(when)}, ${formatTime(when)}`,
                  cost === 'free' ? 'Free' : cost === 'copay' ? 'Co-pay' : cost === 'seeking' ? 'Seeking sponsor' : 'Sponsored',
                  `${spots} spots`,
                  planType === 'open' ? 'Open' : 'Closed',
                ].map((label) => (
                  <View key={label} style={{ paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radii.xs, backgroundColor: colors.surfaceMid }}>
                    <T.MetaXs>{label}</T.MetaXs>
                  </View>
                ))}
              </Row>
            </Stack>

            <Pressable onPress={() => setStep(2)} style={{ alignSelf: 'center', marginTop: spacing.sm + 2 }}>
              <T.Semibold color={colors.coral}>Edit details →</T.Semibold>
            </Pressable>
          </ScreenPad>
        )}
      </ScrollView>
    </Screen>
  );
}
