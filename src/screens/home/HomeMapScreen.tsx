import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import RNMapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { StackScreenProps } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import { MapPin } from '@/components/organisms/MapPin';
import { PlanRow } from '@/components/molecules/PlanRow';
import { SearchBar } from '@/components/atoms/inputs/SearchBar';
import { GOOGLE_MAPS_MUTED_STYLE_LIGHT, GOOGLE_MAPS_MUTED_STYLE_DARK } from '@/theme/googleMapsDarkStyle';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, shadow, layout, fontFamilies } from '@/theme/tokens';
import { useHomeFeed } from '@/api/hooks/useHomeFeed';
import { useHomeLocation } from '@/api/hooks/useHomeLocation';
import { placesAutocomplete, placeDetails, newPlacesSession, type PlacePrediction } from '@/api/places';
import { planDetailRoute } from '@/utils/plan';
import type { HomeStackParamList } from '@/navigation/types';
import { Plan } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'HomeMap'>;

const KORAMANGALA = { latitude: 12.9352, longitude: 77.6245 };

export function HomeMapScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { location, loading: locationLoading, useGPS } = useHomeLocation();
  const initialCenter = location ? { latitude: location.lat, longitude: location.lng } : KORAMANGALA;
  // The map is a true "explore" view — it re-fetches plans centered on
  // wherever you've panned/searched to, not your fixed home location, so
  // what's plotted always matches the visible area (see mapCenter below).
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const { plans: feed, refetch: refetchFeed } = useHomeFeed({ lat: mapCenter.latitude, lng: mapCenter.longitude, radiusKm: 25 });
  // useHomeFeed only auto-fetches on navigation focus (by design, for the
  // Home list) — it does NOT refetch just because its params changed. Since
  // this screen changes `mapCenter` without any focus event firing, we have
  // to explicitly trigger a refetch ourselves whenever it moves, or the map
  // would silently keep showing whatever was loaded at first mount forever.
  const isFirstCenterRef = useRef(true);
  useEffect(() => {
    if (isFirstCenterRef.current) { isFirstCenterRef.current = false; return; }
    refetchFeed();
  }, [mapCenter, refetchFeed]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [search, setSearch] = useState('');
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const placesSessionRef = useRef(newPlacesSession());
  // react-native-map-clustering forwards its ref to the underlying
  // react-native-maps MapView instance, but its own .d.ts types the ref as
  // the wrapper class (no imperative methods) — type against the real MapView.
  const mapRef = useRef<RNMapView>(null);
  // A marker tap also bubbles up to the MapView's own onPress (used to
  // dismiss the card on an outside tap) — this suppresses that one bubbled
  // dismissal so opening a pin doesn't immediately close itself.
  const suppressNextMapPress = useRef(false);
  // Debounce refetching while the user is actively dragging/pinching, so we
  // don't fire a request on every intermediate frame — only once the pan
  // settles. Programmatic moves (search, recenter) set mapCenter directly
  // instead of waiting on this.
  const regionChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegionChangeComplete = useCallback((region: { latitude: number; longitude: number }) => {
    if (regionChangeTimer.current) clearTimeout(regionChangeTimer.current);
    regionChangeTimer.current = setTimeout(() => {
      setMapCenter({ latitude: region.latitude, longitude: region.longitude });
    }, 400);
  }, []);

  // Search does two independent things: filters the plan pins/heatmap by
  // text match (below), and — since typing a place name shouldn't just
  // filter, it should actually take you there — looks up place predictions
  // so picking one can pan the map (same Places API + session pattern as
  // LocSearchScreen).
  useEffect(() => {
    let cancelled = false;
    const q = search.trim();
    if (q.length < 2) { setPlacePredictions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await placesAutocomplete(q, placesSessionRef.current);
        if (!cancelled) setPlacePredictions(r);
      } catch {
        if (!cancelled) setPlacePredictions([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const pickPlace = useCallback(async (p: PlacePrediction) => {
    if (placeSearchBusy) return;
    setPlaceSearchBusy(true);
    try {
      const loc = await placeDetails(p.placeId, placesSessionRef.current);
      placesSessionRef.current = newPlacesSession(); // selection closes the billing session
      setMapCenter({ latitude: loc.lat, longitude: loc.lng });
      mapRef.current?.animateToRegion(
        { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        400,
      );
    } finally {
      setPlaceSearchBusy(false);
      setPlacePredictions([]);
      setSearch('');
    }
  }, [placeSearchBusy]);

  // The shared nav bar floats over this screen as an absolute overlay
  // (see AppTabBar's OVERLAY_SCREENS) — keep our own floating controls and
  // the plan card above it instead of sitting behind/under it.
  const navOverlayHeight = layout.navBarHeight + insets.bottom + spacing.sm;

  const visiblePlans = feed.filter((p) => p.status === 'active' || p.status === 'full');
  const q = search.trim().toLowerCase();
  const filteredPlans = q
    ? visiblePlans.filter((p) => p.activity.toLowerCase().includes(q) || p.location.toLowerCase().includes(q))
    : visiblePlans;

  const recenter = useCallback(async () => {
    await useGPS();
    if (location) {
      setMapCenter({ latitude: location.lat, longitude: location.lng });
      mapRef.current?.animateToRegion(
        { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    }
  }, [useGPS, location]);

  // `initialRegion` only applies on the MapView's first mount — react-native-maps
  // ignores later changes to it. Wait for the chosen location to resolve
  // (AsyncStorage read, or GPS on first-ever use) before mounting the map at
  // all, otherwise it always opens at the KORAMANGALA fallback and never
  // recovers without a manual recenter.
  if (locationLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ClusteredMapView
        ref={mapRef}
        // Apple Maps on iOS, Google Maps on Android (PROVIDER_DEFAULT). iOS
        // was switched to PROVIDER_GOOGLE for the heatmap experiment, but
        // that surfaced a real bug: react-native-maps' Fabric interop with
        // Google Maps on iOS silently fails to render Marker children once
        // there are ~30+ of them (proven by seeding 150 plans — Android,
        // using a completely different native Maps binding, rendered every
        // pin correctly from the same data; iOS showed none). Since the
        // heatmap that motivated Google Maps on iOS is gone, revert to the
        // originally-proven-working Apple Maps path.
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        // 'mutedStandard' is an iOS-only Apple Maps style; Android's Google
        // Maps doesn't have an equivalent and would reject/ignore it.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        // customMapStyle only affects Google Maps — Android needs it to mute
        // POI clutter and follow dark mode; iOS gets both via mapType/
        // userInterfaceStyle instead.
        userInterfaceStyle={mode}
        customMapStyle={Platform.OS === 'android' ? (mode === 'dark' ? GOOGLE_MAPS_MUTED_STYLE_DARK : GOOGLE_MAPS_MUTED_STYLE_LIGHT) : []}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        clusterColor={colors.coral}
        clusterTextColor="#fff"
        initialRegion={{ latitude: initialCenter.latitude, longitude: initialCenter.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={() => {
          if (suppressNextMapPress.current) { suppressNextMapPress.current = false; return; }
          setSelected(null);
        }}
      >
        {filteredPlans.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => {
              suppressNextMapPress.current = true;
              setSelected(p);
            }}
          >
            <MapPin plan={p} />
          </Marker>
        ))}
      </ClusteredMapView>

      {/* Floating search bar + place-autocomplete dropdown */}
      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search plans, activities, places…" variant="floating" />
        {placePredictions.length > 0 ? (
          <View style={[{ marginTop: spacing.md, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.bg }, shadow.lg]}>
            {placePredictions.map((p, i) => (
              <Pressable
                key={p.placeId}
                onPress={() => pickPlace(p)}
                disabled={placeSearchBusy}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.lg,
                  paddingVertical: 14,
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: i < placePredictions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Icon name="map-pin" size={iconSizes.sm} color={colors.textDim} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 14, color: colors.text }} numberOfLines={1}>{p.main}</Text>
                  {p.secondary ? (
                    <Text style={{ fontFamily: fontFamilies.medium, fontSize: 11, color: colors.textSub }} numberOfLines={1}>{p.secondary}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Floating bottom-right: create plan + recenter — hidden while the
          plan card is open so they don't sit on top of it. */}
      {!selected ? (
        <View style={{ position: 'absolute', bottom: navOverlayHeight + 60, right: spacing.md, alignItems: 'center', gap: spacing.md }}>
          <Pressable
            onPress={() => navigation.navigate('Create')}
            style={[{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral }, shadow.coral]}
            accessibilityRole="button"
            accessibilityLabel="Post a plan"
          >
            <Icon name="plus" size={iconSizes.md} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={recenter}
            style={[{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }, shadow.lg]}
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location"
          >
            <Icon name="crosshair" size={iconSizes.md} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {/* Selected plan card — same info as PlanRow in the list view. Tapping
          the map itself (not this card) dismisses it; no explicit close button. */}
      {selected ? (
        <View
          style={[
            { position: 'absolute', bottom: navOverlayHeight, left: spacing.md, right: spacing.md, borderRadius: radii.xxl, overflow: 'hidden', paddingTop: spacing.xs, paddingBottom: spacing.sm, backgroundColor: colors.bg },
            shadow.lg,
          ]}
        >
          <PlanRow
            plan={selected}
            variant={selected.viewerJoined ? 'joined' : 'nearby'}
            bordered={false}
            tinted={false}
            onPress={() => navigation.navigate(planDetailRoute(selected), { planId: selected.id })}
            onJoin={(id) => navigation.navigate('Plan', { planId: id })}
          />
        </View>
      ) : null}
    </View>
  );
}
