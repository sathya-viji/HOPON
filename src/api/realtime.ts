/**
 * Realtime subscriptions — Wave 3.
 *
 * Thin wrappers over Supabase realtime (postgres_changes). The tables are in the
 * `supabase_realtime` publication (migration 0015a): messages, notifications,
 * plan_members. Each helper returns an unsubscribe fn the caller runs on cleanup.
 *
 * Payloads are the raw DB rows (snake_case). For chat, the screen maps the row
 * itself (it already holds author profiles). For notifications the realtime row
 * lacks the embedded actor profile, so callers refetch the enriched list rather
 * than rendering the bare row.
 */
import { supabase } from './client';
import { mapMessageRow, type ChatMessageRaw } from './chat';

type Row = Record<string, any>;

/** Live INSERTs into a plan's chat. Returns an unsubscribe fn. */
export function subscribeToPlanMessages(
  planId: string,
  onInsert: (msg: ChatMessageRaw) => void,
): () => void {
  const channel = supabase
    .channel(`plan:${planId}:messages`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `plan_id=eq.${planId}` },
      (payload) => onInsert(mapMessageRow(payload.new as unknown as Parameters<typeof mapMessageRow>[0])),
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/**
 * Live notification INSERTs for a user. The realtime row carries actor_id but
 * not the actor's profile, so callers should refetch the enriched feed (and
 * unread count) on fire rather than rendering the payload directly.
 */
export function subscribeToNotifications(
  userId: string,
  onInsert: (row: Row) => void,
): () => void {
  const channel = supabase
    .channel(`user:${userId}:notifications`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as Row),
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
