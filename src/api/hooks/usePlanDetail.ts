/**
 * usePlanDetail — fetch a single plan's detail (host + joiners + viewer state).
 * Plain useState/useEffect, matching useHomeFeed. Used by the Plan screen and
 * the join/leave/cancel confirmation screens (which show the plan's basics).
 */
import { useCallback, useEffect, useState } from 'react';
import { getPlanDetail } from '@/api/plans';
import type { PlanDetail } from '@/api/mappers';

export interface PlanDetailState {
  detail: PlanDetail | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePlanDetail(planId: string | undefined): PlanDetailState {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!planId) { setError(new Error('plan_not_found')); setLoading(false); return; }
    setLoading(true);
    try {
      setDetail(await getPlanDetail(planId));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  return { detail, loading, error, refetch: load };
}
