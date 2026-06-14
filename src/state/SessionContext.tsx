/**
 * SessionContext — in-memory session state shared across screens.
 *
 * Screens previously kept join/notification state in component-local
 * useState, so joining a plan on the Plan screen never updated the Home
 * list, and notification read/approved state reset on every remount.
 * This context is the single source of truth for that session state,
 * seeded once from the mock data.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { plans, notifications as seedNotifs, CURRENT_USER_ID } from '@/mocks';
import { Notification } from '@/types';

interface SessionValue {
  joinedPlanIds: Set<string>;
  joinPlan: (planId: string) => void;
  leavePlan: (planId: string) => void;
  notifs: Notification[];
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

const seedJoined = () =>
  new Set(
    plans
      .filter((p) => p.joinerIds.includes(CURRENT_USER_ID) && (p.status === 'active' || p.status === 'full'))
      .map((p) => p.id),
  );

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [joinedPlanIds, setJoinedPlanIds] = useState<Set<string>>(seedJoined);
  const [notifs, setNotifs] = useState<Notification[]>(seedNotifs);

  const joinPlan = useCallback((planId: string) => {
    setJoinedPlanIds((prev) => new Set(prev).add(planId));
  }, []);

  const leavePlan = useCallback((planId: string) => {
    setJoinedPlanIds((prev) => {
      const next = new Set(prev);
      next.delete(planId);
      return next;
    });
  }, []);

  const markNotifRead = useCallback((id: string) => {
    setNotifs((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setNotifs((list) => list.map((n) => ({ ...n, isRead: true })));
  }, []);

  const value = useMemo(
    () => ({ joinedPlanIds, joinPlan, leavePlan, notifs, markNotifRead, markAllNotifsRead }),
    [joinedPlanIds, joinPlan, leavePlan, notifs, markNotifRead, markAllNotifsRead],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
