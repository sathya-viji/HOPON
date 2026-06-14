/**
 * Supabase client — the single entry point to the backend.
 *
 * React Native specifics:
 *  - `react-native-url-polyfill/auto` is required (supabase-js uses the URL API).
 *  - Session storage prefers AsyncStorage (persists across launches; the
 *    Supabase-documented Expo path, no 2 KB SecureStore limit). If the
 *    AsyncStorage NATIVE module isn't in the running binary yet (a dev client
 *    built before it was added), we fall back to in-memory storage so the app
 *    still boots — sessions just won't survive a reload until the dev client is
 *    rebuilt (`npx expo run:ios`). We detect this via NativeModules so we never
 *    touch a null native module at startup.
 *  - `autoRefreshToken` is paired with an AppState listener (startAuthAutoRefresh).
 *  - `detectSessionInUrl: false` — no URL-based OAuth in this app.
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (.env.local).
 */
import 'react-native-url-polyfill/auto';
import { AppState, NativeModules } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Create .env.local from `supabase status` (see docs/BACKEND_DEV.md).',
  );
}

interface SimpleStorage {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}

function inMemoryStorage(): SimpleStorage {
  const mem = new Map<string, string>();
  return {
    getItem: async (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k, v) => { mem.set(k, v); },
    removeItem: async (k) => { mem.delete(k); },
  };
}

function resolveAuthStorage(): SimpleStorage {
  // AsyncStorage's native module is RNCAsyncStorage. Only require the JS module
  // if the native side is actually linked, so we never crash on a null module.
  if (NativeModules?.RNCAsyncStorage || NativeModules?.PlatformLocalStorage) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-async-storage/async-storage').default as SimpleStorage;
  }
  console.warn(
    '[auth] AsyncStorage native module not in this build — using in-memory ' +
      'session storage (sessions reset on reload). Rebuild the dev client ' +
      '(npx expo run:ios) to persist sessions.',
  );
  return inMemoryStorage();
}

// Shared with AuthContext so the "onboarded" gate flag persists in the same
// store as the session (and shares the in-memory fallback when AsyncStorage's
// native module isn't in the running binary).
export const authStorage = resolveAuthStorage();

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let autoRefreshStarted = false;

/** Wire token auto-refresh to foreground state. Call once at app start. */
export function startAuthAutoRefresh(): void {
  if (autoRefreshStarted) return;
  autoRefreshStarted = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
