/**
 * useFeatureFlag — gate UI on a server-side feature flag (Wave 7).
 *
 * Returns `enabled` (defaults false until resolved, so gated features stay off
 * during load and on error) plus `loading`. The server applies the flag's
 * rollout-percentage bucketing per user, so the same user always gets a stable
 * answer for a given flag.
 *
 *   const { enabled } = useFeatureFlag('new_thing');
 *   if (enabled) { ... }
 */
import { useEffect, useState } from 'react';
import { isFeatureEnabled } from '@/api/growth';

export function useFeatureFlag(flag: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    isFeatureEnabled(flag)
      .then((v) => { if (!cancelled) setEnabled(v); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [flag]);

  return { enabled, loading };
}
