/**
 * SessionContext — app-wide notification state (Wave 3, real backend).
 *
 * Single source of truth for the notification feed + unread count, shared by the
 * Notifications screen and the bottom-nav unread badge (AppTabBar). Loads via the
 * `get_notifications` RPC, keeps the unread count via a cheap own-row COUNT, and
 * stays live by subscribing to `notifications` realtime inserts (on fire it
 * refetches, since the realtime row lacks the embedded actor profile). Mark-read
 * is optimistic then reconciled against the RPC.
 *
 * Auth-aware: (re)loads + (re)subscribes whenever a session appears and clears on
 * sign-out, so the badge is correct across login/logout without a remount.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/api/client';
import { getNotifications, getUnreadCount, markNotificationsRead } from '@/api/notifications';
import { subscribeToNotifications } from '@/api/realtime';
import { registerForPushNotificationsAsync, resetPushRegistration } from '@/services/push';
import { Notification } from '@/types';

interface SessionValue {
  notifs: Notification[];
  unreadCount: number;
  loading: boolean;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  refreshNotifs: () => void;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const uidRef = useRef<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!uidRef.current) { setNotifs([]); setUnreadCount(0); setLoading(false); return; }
    if (!loadedOnce.current) setLoading(true);
    try {
      const [list, count] = await Promise.all([getNotifications(), getUnreadCount()]);
      setNotifs(list);
      setUnreadCount(count);
      loadedOnce.current = true;
    } catch {
      // offline / transient — keep whatever we last had
    } finally {
      setLoading(false);
    }
  }, []);

  // Track auth; (re)load + (re)subscribe to realtime on a fresh session.
  useEffect(() => {
    let unsub: (() => void) | null = null;

    const wire = (userId: string | null) => {
      unsub?.(); unsub = null;
      uidRef.current = userId;
      loadedOnce.current = false;
      if (!userId) { setNotifs([]); setUnreadCount(0); setLoading(false); resetPushRegistration(); return; }
      void load();
      void registerForPushNotificationsAsync(); // guarded; no-ops on simulator
      unsub = subscribeToNotifications(userId, () => { void load(); });
    };

    supabase.auth.getSession().then(({ data }) => wire(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const next = session?.user.id ?? null;
      if (next !== uidRef.current) wire(next);
    });

    return () => { unsub?.(); sub.subscription.unsubscribe(); };
  }, [load]);

  const markNotifRead = useCallback((id: string) => {
    setNotifs((list) => {
      const target = list.find((n) => n.id === id);
      if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
      return list.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    });
    void markNotificationsRead([id]).catch(() => { void load(); });
  }, [load]);

  const markAllNotifsRead = useCallback(() => {
    setNotifs((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    void markNotificationsRead().catch(() => { void load(); });
  }, [load]);

  const value = useMemo(
    () => ({ notifs, unreadCount, loading, markNotifRead, markAllNotifsRead, refreshNotifs: load }),
    [notifs, unreadCount, loading, markNotifRead, markAllNotifsRead, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
