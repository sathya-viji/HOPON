/**
 * push-sender — Phase 3 Edge Function (execution doc Part 5 / Part 8.2)
 *
 * Invoked by the notifications-INSERT webhook: POST { notification_id }.
 * Pipeline:
 *   1. Load the notification.
 *   2. notif_push_allowed(user, type) — respects prefs except 6 non-configurable
 *      types (single source of truth lives in the DB function).
 *   3. Load the recipient's push tokens.
 *   4. Send via Expo Push; prune DeviceNotRegistered tokens.
 *   5. On unexpected failure, enqueue a pending_jobs row for the retry cron and
 *      still return 200 (never fail the webhook).
 *
 * In-app delivery is realtime (the row itself) — this function only adds PUSH.
 */
import { serviceClient, json } from '../_shared/client.ts';
import { titleFor, sendExpoPush, type ExpoMessage } from '../_shared/notif-copy.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let notificationId: string | undefined;
  try {
    const body = await req.json();
    // Accept both our shape { notification_id } and Supabase webhook { record }.
    notificationId = body?.notification_id ?? body?.record?.id;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!notificationId) return json({ error: 'missing notification_id' }, 400);

  const db = serviceClient();

  try {
    const { data: notif, error: nErr } = await db
      .from('notifications')
      .select('id, user_id, type, body, plan_id, recap_id')
      .eq('id', notificationId)
      .single();
    if (nErr || !notif) return json({ status: 'notification_not_found' }, 200);

    // 2. preference gate (DB is the single source of truth)
    const { data: allowed } = await db.rpc('notif_push_allowed', {
      p_user: notif.user_id,
      p_type: notif.type,
    });
    if (allowed === false) return json({ status: 'suppressed_by_prefs' }, 200);

    // 3. tokens
    const { data: tokens } = await db
      .from('push_tokens')
      .select('token')
      .eq('user_id', notif.user_id);
    if (!tokens || tokens.length === 0) return json({ status: 'no_tokens' }, 200);

    // 4. send
    const messages: ExpoMessage[] = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: titleFor(notif.type),
      body: notif.body,
      data: { type: notif.type, plan_id: notif.plan_id, recap_id: notif.recap_id, notification_id: notif.id },
    }));
    const dead = await sendExpoPush(messages);
    if (dead.length > 0) {
      await db.from('push_tokens').delete().in('token', dead);
    }

    return json({ status: 'sent', recipients: tokens.length, pruned: dead.length }, 200);
  } catch (e) {
    console.error('[push-sender] failure', e);
    await db.from('pending_jobs').insert({
      job_type: 'push-sender',
      payload: { notification_id: notificationId },
      last_error: String(e),
      next_retry: new Date(Date.now() + 60_000).toISOString(),
    });
    return json({ status: 'enqueued_retry' }, 200);
  }
});
