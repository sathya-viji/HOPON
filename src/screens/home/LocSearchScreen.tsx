import React, { useState, useEffect, useRef } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { Pressable } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Icon } from '@/components/atoms/Icon';
import { Button } from '@/components/atoms/Button';
import { SearchBar } from '@/components/atoms/inputs/SearchBar';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, iconSizes, radii } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import {
  placesAutocomplete,
  placeDetails,
  newPlacesSession,
  type PlacePrediction,
  type PlaceLocation,
} from '@/api/places';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'LocSearch'>;

// `popTo` is React Navigation 7's new method and is not yet in the TypeScript
// type definitions. This alias documents the call shape until upstream adds it.
type StackNavWithPopTo = Props['navigation'] & {
  popTo: (screen: string, params?: Record<string, unknown>, options?: { merge?: boolean }) => void;
};

const FALLBACK_REGION: Region = { latitude: 12.9352, longitude: 77.6245, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export function LocSearchScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const returnTo = route.params?.returnTo ?? 'Create';
  const [mode, setMode] = useState<'search' | 'map'>('search');
  const [mapRegion, setMapRegion] = useState<Region>(FALLBACK_REGION);
  const [mapCenter, setMapCenter] = useState({ lat: FALLBACK_REGION.latitude, lng: FALLBACK_REGION.longitude });
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); // resolving a pick / locating
  const sessionRef = useRef(newPlacesSession());

  // Debounced Google Places autocomplete (≥2 chars). Predictions only — exact
  // coordinates come from Place Details on selection.
  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (q.length < 2) { setPredictions([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await placesAutocomplete(q, sessionRef.current);
        if (!cancelled) setPredictions(r);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // popTo (not navigate): RN7 navigate() pushes a fresh screen instance, which
  // resets the Create wizard. popTo returns to the existing instance, merging params.
  const finish = (loc: PlaceLocation) => {
    const params = { location: loc.label, lat: loc.lat, lng: loc.lng };
    const nav = navigation as unknown as StackNavWithPopTo;
    if (returnTo === 'PlanEdit') nav.popTo('PlanEdit', params, { merge: true });
    else if (returnTo === 'Home') nav.popTo('Home');
    else nav.popTo('Create', params, { merge: true });
  };

  const pickPrediction = async (p: PlacePrediction) => {
    if (busy) return;
    setBusy(true);
    try {
      const loc = await placeDetails(p.placeId, sessionRef.current);
      sessionRef.current = newPlacesSession(); // selection closes the billing session
      finish({ ...loc, label: p.main || loc.label });
    } catch {
      setBusy(false);
      toast.show('Couldn’t get that location. Try another.');
    }
  };

  const useNearMe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.show('Allow location access to use “Near me”.'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      let label = 'Current location';
      try {
        const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (g) label = g.district || g.subregion || g.city || g.name || label;
      } catch { /* keep the generic label */ }
      finish({ label, lat: latitude, lng: longitude });
    } catch {
      setBusy(false);
      toast.show('Couldn’t get your location.');
    }
  };

  const openMapPicker = async () => {
    setMode('map');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return; // keep the fallback region
      const pos = await Location.getCurrentPositionAsync({});
      const region = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setMapRegion(region);
      setMapCenter({ lat: region.latitude, lng: region.longitude });
    } catch { /* keep the fallback region */ }
  };

  const confirmMapCenter = async () => {
    if (confirming) return;
    setConfirming(true);
    let label = 'Dropped pin';
    try {
      const [g] = await Location.reverseGeocodeAsync({ latitude: mapCenter.lat, longitude: mapCenter.lng });
      if (g) label = g.district || g.subregion || g.city || g.name || label;
    } catch { /* keep the generic label */ }
    finish({ label, lat: mapCenter.lat, lng: mapCenter.lng });
  };

  if (mode === 'map') {
    return (
      <Screen
        header={<ScreenHeader title="Pick a spot" onBack={() => setMode('search')} />}
        scroll={false}
        footer={
          <ScreenPad>
            <Button
              variant="primary-coral"
              label={confirming ? 'Locating…' : 'Confirm this location'}
              onPress={confirmMapCenter}
              disabled={confirming}
            />
          </ScreenPad>
        }
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingVertical: spacing.md }}>
          <View style={{ flex: 1, borderRadius: radii.md, overflow: 'hidden' }}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={mapRegion}
              onRegionChangeComplete={(r) => setMapCenter({ lat: r.latitude, lng: r.longitude })}
            />
            <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -iconSizes.xxl / 2, marginTop: -iconSizes.xxl, alignItems: 'center' }}>
              <Icon name="map-pin" size={iconSizes.xxl} color={colors.coral} strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Set location" onBack={() => navigation.goBack()} />} scroll={false}>
      <Stack style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search places, areas…" autoFocus />
      </Stack>
      <FlatList
        data={predictions}
        keyExtractor={(item) => item.placeId}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Pressable
              onPress={useNearMe}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
            >
              <Stack style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cost.freeBg }}>
                {busy ? <ActivityIndicator size="small" color={colors.cost.freeFg} /> : <Icon name="crosshair" size={iconSizes.sm} color={colors.cost.freeFg} />}
              </Stack>
              <T.BodyLg color={colors.cost.freeFg} style={{ flex: 1 }}>Near me</T.BodyLg>
            </Pressable>
            <Pressable
              onPress={openMapPicker}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Select on map"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface }}
            >
              <Stack style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
                <Icon name="map" size={iconSizes.sm} color={colors.textSub} />
              </Stack>
              <T.BodyLg color={colors.text} style={{ flex: 1 }}>Select on map</T.BodyLg>
            </Pressable>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pickPrediction(item)}
            disabled={busy}
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
          loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.coral} />
            </View>
          ) : query.trim().length >= 2 ? (
            <EmptyState emoji="📍" title="No places found" sub={`Try a different search for "${query.trim()}"`} />
          ) : (
            <View style={{ paddingVertical: 32, paddingHorizontal: spacing.screenPx, alignItems: 'center' }}>
              <T.BodyMd color={colors.textSub} style={{ textAlign: 'center' }}>Search for a place or area, or use “Near me”.</T.BodyMd>
            </View>
          )
        }
      />
    </Screen>
  );
}
