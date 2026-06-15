/**
 * Suspension banner state.
 *
 * The client can't read its own `account_status` (it isn't exposed on
 * users_public), so we surface suspension reactively: whenever an RPC fails with
 * the `account_suspended` code (flagged centrally from api/errors), we flip this
 * flag and a global banner explains the read-only state. Session-scoped
 * (in-memory) — it clears on sign-out and on app restart; a successful write
 * after a suspension lifts simply won't re-set it.
 */
import { useSyncExternalStore } from 'react';

let suspended = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSuspended(v: boolean): void {
  if (suspended === v) return;
  suspended = v;
  emit();
}

function getSnapshot(): boolean { return suspended; }
function subscribe(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); }

export function useSuspended(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
