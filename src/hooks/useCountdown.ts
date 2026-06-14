/**
 * useCountdown — live countdown in minutes to a future ISO timestamp.
 *
 * Ticks every second and returns the current minutes-until-start. Returns a
 * negative number once the start time has passed (caller should treat <= 0
 * as "now" or "expired" depending on context).
 *
 * The interval is cleared on unmount. Passing a stable ISO string reference
 * avoids restarting the interval on every render.
 */
import { useEffect, useState } from 'react';
import { diffMins } from '@/utils/time';

export function useCountdown(startsAt: string): number {
  const [mins, setMins] = useState(() => diffMins(startsAt));
  useEffect(() => {
    setMins(diffMins(startsAt));
    const id = setInterval(() => setMins(diffMins(startsAt)), 1000);
    return () => clearInterval(id);
  }, [startsAt]);
  return mins;
}
