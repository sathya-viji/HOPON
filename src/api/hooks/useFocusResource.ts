/**
 * useFocusResource — generic fetch-on-focus + refresh state, matching the
 * useHomeFeed pattern (plain useState; loads on first focus, silently refreshes
 * on subsequent focuses). Powers the Wave 5 social screens that just need
 * "load this async value, expose loading/refreshing/error/refetch".
 *
 * `loader` is captured by ref so the focus effect never re-subscribes (which
 * would double-fetch); pass a stable key in `deps` to force a reload when inputs
 * change.
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export interface FocusResource<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: unknown;
  refetch: () => void;
  /** Optimistically replace the data without a network round-trip. */
  set: (next: T) => void;
}

export function useFocusResource<T>(loader: () => Promise<T>, deps: unknown[] = []): FocusResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const next = await loaderRef.current();
      setData(next);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  const firstRef = useRef(true);
  const key = JSON.stringify(deps);

  useFocusEffect(
    useCallback(() => {
      load(firstRef.current ? 'initial' : 'refresh');
      firstRef.current = false;
    }, [load, key]),
  );

  const refetch = useCallback(() => load(loadedRef.current ? 'refresh' : 'initial'), [load]);

  return { data, loading: loading && !loaded, refreshing, error, refetch, set: setData };
}
