import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import * as Location from 'expo-location';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { updateMyProfile } from '@/api/users';
import { placesAutocomplete, newPlacesSession, type PlacePrediction } from '@/api/places';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsNeighbourhood'>;

export function SettingsNeighbourhoodScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    if (selected) setSelected(null);
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

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateMyProfile({ neighbourhood: selected });
      toast.show('Neighbourhood updated');
      navigation.goBack();
    } catch {
      toast.show('Failed to update — try again');
    } finally {
      setSaving(false);
    }
  };

  const footer = selected ? (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: borderWidths.thin, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button variant="primary-coral" label={saving ? 'Saving…' : 'Save neighbourhood'} onPress={save} disabled={saving} />
    </View>
  ) : undefined;

  return (
    <Screen header={<ScreenHeader title="Change neighbourhood" onBack={() => navigation.goBack()} />} footer={footer} scroll={false}>
      {/* Search input */}
      <Stack style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: radii.md, borderWidth: borderWidths.medium, borderColor: selected ? colors.text : colors.borderMid, backgroundColor: colors.surface }}>
          <Icon name="search" size={iconSizes.sm} color={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search neighbourhood, area or city…"
            placeholderTextColor={colors.textDim}
            style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text }}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setSelected(null); setPredictions([]); }} hitSlop={8}>
              <Icon name="x" size={16} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      </Stack>

      <FlatList
        data={predictions}
        keyExtractor={(item) => item.placeId}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Pressable
            onPress={useCurrentLocation}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
          >
            <Stack style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cost.freeBg }}>
              <Icon name="crosshair" size={iconSizes.sm} color={colors.cost.freeFg} />
            </Stack>
            <T.BodyLg color={colors.cost.freeFg} style={{ flex: 1 }}>Use my current location</T.BodyLg>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pickPrediction(item)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
          >
            <Icon name="map-pin" size={iconSizes.sm} color={colors.textDim} />
            <Stack style={{ flex: 1 }}>
              <T.BodyLg color={colors.text} numberOfLines={1}>{item.main}</T.BodyLg>
              {item.secondary ? <T.MetaXs numberOfLines={1}>{item.secondary}</T.MetaXs> : null}
            </Stack>
          </Pressable>
        )}
        ListEmptyComponent={
          searching ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : query.trim().length >= 2 ? (
            <View style={{ paddingVertical: 24, paddingHorizontal: spacing.screenPx }}>
              <T.BodyMd color={colors.textSub} style={{ textAlign: 'center' }}>No places found. Try a different search.</T.BodyMd>
            </View>
          ) : (
            <View style={{ paddingVertical: 32, paddingHorizontal: spacing.screenPx, alignItems: 'center' }}>
              <T.BodyMd color={colors.textSub} style={{ textAlign: 'center' }}>Search for your neighbourhood, area, or city.</T.BodyMd>
            </View>
          )
        }
      />
    </Screen>
  );
}
