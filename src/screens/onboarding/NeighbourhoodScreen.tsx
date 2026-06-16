import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import * as Location from 'expo-location';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii, borderWidths } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/state/AuthContext';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';
import { completeSignup, setInterests, hasProfile } from '@/api/auth';
import { updateMyProfile } from '@/api/users';
import { placesAutocomplete, newPlacesSession, type PlacePrediction } from '@/api/places';
import { errorMessage, errorCode } from '@/api/errors';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'Neighbourhood'>;

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

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sessionRef = useRef(newPlacesSession());

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (q.length < 2) { setPredictions([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await placesAutocomplete(q, sessionRef.current);
        if (!cancelled) setPredictions(r);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (selected) setSelected(null); // clear confirmed selection if user edits
  };

  const pickPrediction = (p: PlacePrediction) => {
    const label = p.secondary ? `${p.main}, ${p.secondary}` : p.main;
    setSelected(label);
    setQuery(label);
    setPredictions([]);
    sessionRef.current = newPlacesSession();
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.show('Location access denied — search manually'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      let label = 'Current location';
      try {
        const [g] = await Location.reverseGeocodeAsync(pos.coords);
        if (g) label = g.district || g.subregion || g.city || g.name || label;
      } catch { /* keep generic label */ }
      setSelected(label);
      setQuery(label);
      setPredictions([]);
    } catch {
      toast.show('Could not get location — search manually');
    }
  };

  const finishOnboarding = async () => {
    if (!selected) { toast.show('Pick your neighbourhood'); return; }
    if (!draft.name || !draft.handle || !draft.dob || !draft.gender) {
      toast.show('Please complete the earlier steps');
      return;
    }
    setSubmitting(true);
    try {
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
      if (draft.avatarPath) {
        try { await updateMyProfile({ avatarPath: draft.avatarPath }); } catch { /* non-blocking */ }
      }
      await refresh();
    } catch (e) {
      try {
        if (await hasProfile()) { await refresh(); return; }
      } catch { /* still offline */ }
      setSubmitting(false);
      if (errorCode(e) === 'handle_taken') {
        toast.show('That username was just taken — pick another.');
        navigation.navigate('SignupName');
        return;
      }
      toast.show(errorMessage(e, "Couldn't finish setup — your details are saved, try again."));
    }
  };

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => navigation.goBack()} />
    </View>
  );

  const footer = (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: 1, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button
        variant="primary-coral"
        label={submitting ? 'Setting up…' : 'Start exploring →'}
        onPress={finishOnboarding}
        disabled={!selected || submitting}
      />
    </View>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: 24, paddingBottom: 16 }}>
        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 6, color: colors.text }}>
          Where are you based?
        </Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.5, color: colors.textSub }}>
          We'll show you plans in your area first. You can change this anytime.
        </Text>
      </View>

      {/* Search input */}
      <View style={{ marginHorizontal: spacing.screenPx, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: radii.md, borderWidth: borderWidths.medium, borderColor: selected ? colors.text : colors.borderMid, backgroundColor: colors.surface }}>
        <Icon name="search" size={18} color={colors.textDim} />
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search your area, city or neighbourhood…"
          placeholderTextColor={colors.textDim}
          style={{ flex: 1, paddingVertical: 13, fontFamily: fontFamilies.regular, fontSize: 15, color: colors.text }}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setSelected(null); setPredictions([]); }} hitSlop={8}>
            <Icon name="x" size={16} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={predictions}
        keyExtractor={(item) => item.placeId}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Pressable
            onPress={useCurrentLocation}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cost.freeBg }}>
              <Icon name="crosshair" size={18} color={colors.cost.freeFg} />
            </View>
            <Text style={{ flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, color: colors.cost.freeFg }}>
              Use my current location
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pickPrediction(item)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
          >
            <Icon name="map-pin" size={18} color={colors.textDim} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 15, color: colors.text }} numberOfLines={1}>
                {item.main}
              </Text>
              {item.secondary ? (
                <Text style={{ fontFamily: fontFamilies.regular, fontSize: 12, color: colors.textSub }} numberOfLines={1}>
                  {item.secondary}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          searching ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : query.trim().length >= 2 ? (
            <View style={{ paddingVertical: 24, paddingHorizontal: spacing.screenPx }}>
              <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, color: colors.textSub, textAlign: 'center' }}>
                No places found. Try a different search.
              </Text>
            </View>
          ) : (
            <View style={{ paddingVertical: 20, paddingHorizontal: spacing.screenPx }}>
              <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, color: colors.textSub, textAlign: 'center' }}>
                Type your neighbourhood, area, or city name.
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
