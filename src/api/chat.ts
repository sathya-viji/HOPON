/**
 * Chat API — Wave 3 (plan group chat; no DMs by design, G4).
 *
 * History is read directly from `messages` (RLS `is_active_member` — a
 * security-definer helper, so no users-column cascade) and live inserts arrive
 * over realtime (see realtime.ts). Sends are RPC-only via `send_message`, which
 * enforces membership + the D3 chat-lock (chat_closed on cancelled/expired,
 * chat_archived 30d after end). Author display names/avatars are resolved by the
 * screen from the plan detail it already holds (host + joiners), so this layer
 * deals only in raw rows.
 */
import { supabase } from './client';

/** A chat message as stored — author identity is resolved by the caller. */
export interface ChatMessageRaw {
  id: string;
  planId: string;
  authorId: string;
  body: string;
  isDeleted: boolean;
  createdAt: string;
}

interface MessageRow {
  id: string;
  plan_id: string;
  author_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
}

export function mapMessageRow(r: MessageRow): ChatMessageRaw {
  return {
    id: r.id,
    planId: r.plan_id,
    authorId: r.author_id,
    body: r.body,
    isDeleted: r.is_deleted,
    createdAt: r.created_at,
  };
}

/** Full chat history for a plan, oldest first (only active members can read). */
export async function getMessages(planId: string): Promise<ChatMessageRaw[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id,plan_id,author_id,body,is_deleted,created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(mapMessageRow);
}

/** Send a message to a plan's group chat. Throws typed chat-lock/membership errors. */
export async function sendMessage(planId: string, body: string): Promise<ChatMessageRaw> {
  const { data, error } = await supabase.rpc('send_message', { p_plan_id: planId, p_body: body });
  if (error) throw error;
  return mapMessageRow(data as MessageRow);
}
