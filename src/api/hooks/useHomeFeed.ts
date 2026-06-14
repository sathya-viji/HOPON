/**
 * useHomeFeed — fetch + refresh state for the Home "Nearby" feed.
 *
 * Plain useState (matching the app's existing data pattern — no react-query
 * yet). Loads on first focus and silently refreshes on every subsequent focus,
 * so returning from Plan/Create reflects a join/leave/new plan. `refetch` powers
 * pull-to-refresh and the error-retry CTA.
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getHomeFeed, type HomeFeedParams } from '@/api/plans';
import type { Plan } from '@/types';

export interface HomeFeedState {
  plans: Plan[];
  loading: boolean;   // first load (no data yet)
  refreshing: boolean; // user-initiated refresh with data already on screen
  error: unknown;
  refetch: () => void;
}

export function useHomeFeed(params: HomeFeedParams = {}): HomeFeedState {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  // params is passed inline by the screen; serialise so the effect only re-runs
  // when the actual values change, not on every render's new object identity.
  const key = JSON.stringify(params);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const data = await getHomeFeed(JSON.parse(key) as HomeFeedParams);
        setPlans(data);
        setError(null);
        setLoaded(true);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key],
  );

  // Always call the latest load from the focus effect without re-subscribing on
  // every load identity change (which would cause an immediate extra fetch).
  const loadRef = useRef(load);
  loadRef.current = load;
  const firstRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      loadRef.current(firstRef.current ? 'initial' : 'refresh');
      firstRef.current = false;
    }, []),
  );

  const refetch = useCallback(() => {
    load(loaded ? 'refresh' : 'initial');
  }, [load, loaded]);

  return { plans, loading: loading && !loaded, refreshing, error, refetch };
}
