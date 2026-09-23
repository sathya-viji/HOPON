import React, { useCallback, useRef, useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import RNMapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { StackScreenProps } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Icon } from '@/components/atoms/Icon';
import { Countdown } from '@/components/atoms/Countdown';
import { CostTag } from '@/components/atoms/CostTag';
import { Button } from '@/components/atoms/Button';
import { MapPin } from '@/components/organisms/MapPin';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, iconSizes, shadow, layout, CATEGORIES } from '@/theme/tokens';
import { useHomeFeed } from '@/api/hooks/useHomeFeed';
import { useHomeLocation } from '@/api/hooks/useHomeLocation';
import { planDetailRoute } from '@/utils/plan';
import type { HomeStackParamList } from '@/navigation/types';
import { Plan } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'HomeMap'>;

const KORAMANGALA = { latitude: 12.9352, longitude: 77.6245 };

export function HomeMapScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { location, useGPS } = useHomeLocation();
  const { plans: feed } = useHomeFeed(location ? { lat: location.lat, lng: location.lng, radiusKm: 25 } : {});
  const [selected, setSelected] = useState<Plan | null>(null);
  // react-native-map-clustering forwards its ref to the underlying
  // react-native-maps MapView instance, but its own .d.ts types the ref as
  // the wrapper class (no imperative methods) — type against the real MapView.
  const mapRef = useRef<RNMapView>(null);

  // The shared nav bar floats over this screen as an absolute overlay
  // (see AppTabBar's OVERLAY_SCREENS) — keep our own floating controls and
  // the plan card above it instead of sitting behind/under it.
  const navOverlayHeight = layout.navBarHeight + insets.bottom + spacing.sm;

  const visiblePlans = feed.filter((p) => p.status === 'active' || p.status === 'full');
  const center = location ? { latitude: location.lat, longitude: location.lng } : KORAMANGALA;
  const selectedCat = selected ? CATEGORIES.find((c) => c.id === selected.categoryId) : undefined;

  const recenter = useCallback(async () => {
    await useGPS();
    if (location) {
      mapRef.current?.animateToRegion(
        { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    }
  }, [useGPS, location]);

  return (
    <View style={{ flex: 1 }}>
      <ClusteredMapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        // 'mutedStandard' is an iOS-only Apple Maps style; Android's Google
        // Maps doesn't have an equivalent and would reject/ignore it.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle={mode}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        clusterColor="#0A0A0A"
        clusterTextColor="#fff"
        initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {visiblePlans.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => setSelected(p)}>
            <MapPin plan={p} />
          </Marker>
        ))}
      </ClusteredMapView>

      {/* Floating bottom-right: create plan + recenter */}
      <View style={{ position: 'absolute', bottom: navOverlayHeight + 60, right: spacing.md, alignItems: 'center', gap: spacing.sm }}>
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
          style={[{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }, shadow.md]}
          accessibilityRole="button"
          accessibilityLabel="Recenter on my location"
        >
          <Icon name="crosshair" size={iconSizes.md} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom-center "See list" pill */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={[{ position: 'absolute', bottom: navOverlayHeight, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 40, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: '#0A0A0A' }, shadow.md]}
        accessibilityRole="button"
        accessibilityLabel="See list"
      >
        <Icon name="list" size={iconSizes.xs} color="#fff" />
        <T.LabelSm style={{ color: '#fff' }}>See list</T.LabelSm>
      </Pressable>

      {/* Selected plan card */}
      {selected ? (
        <View style={[{ position: 'absolute', bottom: navOverlayHeight, left: spacing.md, right: spacing.md, borderRadius: radii.xxl, paddingBottom: spacing.lg, backgroundColor: colors.bg }, shadow.lg]}>
          <View style={{ width: 36, height: 4, borderRadius: radii.full, alignSelf: 'center', marginTop: spacing.md, backgroundColor: colors.borderMid }} />
          <Row gap="md" style={{ padding: spacing.lg, paddingHorizontal: spacing.screenPx }}>
            <Stack style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedCat?.bg ?? colors.surface }}>
              <Icon name={(selectedCat?.icon ?? 'sparkles') as never} size={22} color={selectedCat?.iconColor ?? colors.textSub} strokeWidth={2} />
            </Stack>
            <Stack style={{ flex: 1 }}>
              <T.LabelLg numberOfLines={1}>{selected.activity}</T.LabelLg>
              <T.MetaXs numberOfLines={1}>{selected.location}</T.MetaXs>
              <Row gap="sm" wrap style={{ marginTop: spacing.xs }}>
                <Countdown startsAt={selected.startsAt} />
                <CostTag type={selected.cost} note={selected.costNote} />
              </Row>
            </Stack>
            <Pressable onPress={() => setSelected(null)} hitSlop={spacing.sm}>
              <Icon name="x" size={iconSizes.md} color={colors.textDim} />
            </Pressable>
          </Row>
          <ScreenPad style={{ paddingTop: spacing.xs }}>
            <Button
              variant="primary-coral"
              label="HOP ON"
              onPress={() => navigation.navigate(planDetailRoute(selected), { planId: selected.id })}
            />
          </ScreenPad>
        </View>
      ) : null}
    </View>
  );
}
