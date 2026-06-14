/**
 * OnboardingDraftContext — collects the new-user profile across onboarding
 * screens (Name → Dob → Gender → … → Neighbourhood), where the finale calls
 * completeSignup. Scoped inside OnboardingNavigator so it resets per run.
 *
 * Required by complete_signup: name, handle, dob, gender, neighbourhood.
 * interests is optional (persisted via setInterests after the profile exists).
 * gender is stored in the BACKEND vocabulary (man/woman/nonbinary/prefer_not).
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type Gender = 'man' | 'woman' | 'nonbinary' | 'prefer_not';

export interface OnboardingDraft {
  name: string;
  handle: string;          // stored without leading '@'
  dob: string;             // 'YYYY-MM-DD'
  gender: Gender | null;
  interests: string[];     // category ids
}

const EMPTY: OnboardingDraft = { name: '', handle: '', dob: '', gender: null, interests: [] };

interface DraftValue {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
}

const Ctx = createContext<DraftValue | undefined>(undefined);

export function OnboardingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY);
  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);
  const value = useMemo(() => ({ draft, update }), [draft, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboardingDraft(): DraftValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingDraftProvider');
  return ctx;
}
