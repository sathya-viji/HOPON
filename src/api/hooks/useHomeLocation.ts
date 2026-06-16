/**
 * useHomeLocation — GPS-based location for the home feed.
 *
 * Hierarchy:
 *   1. Manual override (user picked a place) — stored in AsyncStorage
 *   2. Device GPS — requested on first use, result cached for the session
 *   3. null — show all plans (no geo filter)
 *
 * `label` is what shows in the pill (e.g. "Anna Nagar" or "Near you").
 * `lat/lng` are passed directly to get_home_feed.
 * `setManual` is called from the location picker sheet.
 * `useGPS` re-requests GPS and clears any manual override.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const STORAGE_KEY = '@hopon/home_location';

export interface HomeLocation {
  label: string;
  lat: number;
  lng: number;
  source: 'gps' | 'manual';
}

export interface UseHomeLocationResult {
  location: HomeLocation | null;
  loading: boolean;
  setManual: (loc: HomeLocation) => Promise<void>;
  useGPS: () => Promise<void>;
  clear: () => Promise<void>;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!place) return 'Near you';
    return place.district ?? place.subregion ?? place.city ?? place.region ?? 'Near you';
  } catch {
    return 'Near you';
  }
}

async function getGPSLocation(): Promise<HomeLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lng } = pos.coords;
    const label = await reverseGeocode(lat, lng);
    return { label, lat, lng, source: 'gps' };
  } catch {
    return null;
  }
}

export function useHomeLocation(): UseHomeLocationResult {
  const [location, setLocation] = useState<HomeLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          if (!cancelled) setLocation(JSON.parse(stored) as HomeLocation);
          if (!cancelled) setLoading(false);
          return;
        }
        const gps = await getGPSLocation();
        if (!cancelled) setLocation(gps);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setManual = useCallback(async (loc: HomeLocation) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    setLocation(loc);
  }, []);

  const useGPS = useCallback(async () => {
    setLoading(true);
    try {
      const gps = await getGPSLocation();
      await AsyncStorage.removeItem(STORAGE_KEY);
      setLocation(gps);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setLocation(null);
  }, []);

  return { location, loading, setManual, useGPS, clear };
}
