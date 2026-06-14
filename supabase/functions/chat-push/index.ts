/**
 * chat-push — Phase 3 Edge Function (execution doc Part 5.1 / Part 8 chat row)
 *
 * Invoked by the messages-INSERT webhook: POST { message_id }.
 *  - Chat pushes are NOT stored as notification rows (would flood the feed);
 *    they go straight to Expo for active members (minus the author).
 *  - @handle MENTIONS create a `mention` notification row (which drives its own
 *    push-sender).
 *
 * All user-table reads + mention resolution happen in prepare_chat_push (a
 * security-definer RPC): service_role has no read grant on users/users_public
 * by design, and mention matching must see private-profile plan members.
 */
import { serviceClient, json } from '../_shared/client.ts';
import { sendExpoPush, type ExpoMessage } from '../_shared/notif-copy.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let messageId: string | undefined;
  try {
    const body = await req.json();
    messageId = body?.message_id ?? body?.record?.id;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!messageId) return json({ error: 'missing message_id' }, 400);

  const db = serviceClient();

  try {
    // Resolves mentions (side effect: writes mention notifications) and returns
    // the chat-push recipient set + render fields.
    const { data: prep, error: pErr } = await db.rpc('prepare_chat_push', { p_message_id: messageId });
    if (pErr) throw pErr;
    if (!prep || prep.found !== true) return json({ status: 'message_not_found' }, 200);

    const recipientIds: string[] = prep.recipient_ids ?? [];
    if (recipientIds.length === 0) return json({ status: 'no_recipients' }, 200);

    const { data: tokens } = await db
      .from('push_tokens').select('token').in('user_id', recipientIds);
    if (!tokens || tokens.length === 0) return json({ status: 'no_tokens' }, 200);

    const messages: ExpoMessage[] = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: `${prep.author_name} · ${prep.activity}`,
      body: prep.preview,
      data: { type: 'chat', message_id: messageId },
    }));
    const dead = await sendExpoPush(messages);
    if (dead.length > 0) await db.from('push_tokens').delete().in('token', dead);

    return json({ status: 'sent', recipients: tokens.length, pruned: dead.length }, 200);
  } catch (e) {
    console.error('[chat-push] failure', e);
    await db.from('pending_jobs').insert({
      job_type: 'chat-push',
      payload: { message_id: messageId },
      last_error: String(e),
      next_retry: new Date(Date.now() + 60_000).toISOString(),
    });
    return json({ status: 'enqueued_retry' }, 200);
  }
});
