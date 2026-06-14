/**
 * usePlanMembers — the non-host members of a plan (host-only via RLS), for the
 * host's PlanHost (attendees + pending count) and PlanRequests (pending list)
 * screens. Refetches on focus so approve/decline elsewhere reflects on return.
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getPlanMembers, type PlanMemberSummary } from '@/api/plans';

export interface PlanMembersState {
  members: PlanMemberSummary[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePlanMembers(planId: string | undefined): PlanMembersState {
  const [members, setMembers] = useState<PlanMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!planId) { setLoading(false); return; }
    if (!loadedRef.current) setLoading(true);
    try {
      setMembers(await getPlanMembers(planId));
      setError(null);
      loadedRef.current = true;
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  return { members, loading, error, refetch: load };
}
