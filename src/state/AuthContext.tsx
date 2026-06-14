/**
 * AuthContext — top-level auth gate.
 *
 * Computes whether the app should show Onboarding or Main from two facts:
 *   - is there a Supabase session?
 *   - does that user have a completed profile (a public.users row)?
 *
 * status:
 *   'loading'    — still checking on cold boot
 *   'onboarding' — no session, or signed in but no profile yet
 *   'ready'      — signed in AND profile complete → Main
 *
 * `refresh()` re-evaluates; screens call it after verifyOtp / completeSignup /
 * signOut so the gate switches stacks. Supabase calls inside onAuthStateChange
 * are deferred (setTimeout) to avoid the documented client deadlock.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, authStorage } from '@/api/client';
import { getSession, hasProfile } from '@/api/auth';

export type AuthStatus = 'loading' | 'onboarding' | 'ready';

// Persisted marker that this device has a completed profile. It lets us decide
// the gate offline WITHOUT guessing: hasProfile() needs the network, so when it
// throws we trust this flag instead. Set once a profile is confirmed; cleared on
// sign-out. Distinguishes an established user (→ stay in Main offline) from a
// half-onboarded one (session but signup never finished → back to onboarding).
const ONBOARDED_KEY = 'hopon.onboarded';
async function readOnboarded(): Promise<boolean> {
  try { return (await authStorage.getItem(ONBOARDED_KEY)) === '1'; } catch { return false; }
}
async function writeOnboarded(v: boolean): Promise<void> {
  try { if (v) await authStorage.setItem(ONBOARDED_KEY, '1'); else await authStorage.removeItem(ONBOARDED_KEY); } catch { /* best-effort */ }
}

interface AuthValue {
  status: AuthStatus;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const evaluating = useRef(false);

  const refresh = useCallback(async () => {
    if (evaluating.current) return;
    evaluating.current = true;
    try {
      const session = await getSession();
      if (!session) { setStatus('onboarding'); return; }
      try {
        const profile = await hasProfile();
        await writeOnboarded(profile);     // remember the authoritative result
        setStatus(profile ? 'ready' : 'onboarding');
      } catch {
        // A session exists but the profile check failed — almost always a
        // transient network error (hasProfile hits the network). Don't guess:
        // trust the persisted flag. An established user (flag set) stays in Main
        // instead of being bounced to login on a launch blip; a half-onboarded
        // user (signup never finished, no flag) goes to onboarding rather than a
        // broken Main. A genuinely invalid session self-corrects via SIGNED_OUT.
        const onboarded = await readOnboarded();
        setStatus(onboarded ? 'ready' : 'onboarding');
      }
    } catch {
      setStatus('onboarding');
    } finally {
      evaluating.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();   // cold-boot evaluation
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Only auto-advance on SIGNED_OUT (→ onboarding). Sign-IN transitions are
      // driven explicitly by screens via refresh(), so the signup flow can show
      // "already registered" before the gate would otherwise jump to Main.
      // Defer: calling supabase methods synchronously here can deadlock.
      if (event === 'SIGNED_OUT') setTimeout(() => { writeOnboarded(false); refresh(); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return <AuthContext.Provider value={{ status, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
