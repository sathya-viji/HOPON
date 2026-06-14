/**
 * emergency-escalation — Phase 6 Edge Function (execution doc Part 5 / F4)
 *
 * Fired by the reports-INSERT trigger when reason = 'emergency':
 *   POST { report_id, target_type, target_id }
 *
 * Actions (frozen):
 *   1. Page the founder immediately (Twilio SMS to FOUNDER_ALERT_PHONE).
 *   2. Snapshot the report + target into audit_logs (immutable trail).
 *   3. If the target is a plan, auto-hide it pending human review.
 *
 * Local/CI: with no Twilio config the SMS is skipped (logged); the audit
 * snapshot + auto-hide still run so the path is testable without a provider.
 */
import { serviceClient, json } from '../_shared/client.ts';

async function pageFounder(body: string): Promise<'sent' | 'skipped'> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  const to = Deno.env.get('FOUNDER_ALERT_PHONE');
  if (!sid || !token || !from || !to) {
    console.log('[emergency] Twilio not configured — SMS skipped:', body);
    return 'skipped';
  }
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) console.error('[emergency] Twilio error', res.status, await res.text());
  return res.ok ? 'sent' : 'skipped';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b: { report_id?: string; target_type?: string; target_id?: string };
  try { b = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!b.report_id) return json({ error: 'missing report_id' }, 400);

  const db = serviceClient();
  try {
    const { data: report } = await db.from('reports')
      .select('id, reporter_id, target_type, target_id, reason, notes, created_at')
      .eq('id', b.report_id).single();
    if (!report) return json({ status: 'report_not_found' }, 200);

    // 1. page founder
    const sms = await pageFounder(
      `🚨 HopOn EMERGENCY report on ${report.target_type} ${report.target_id}. Review now.`);

    // 2. immutable snapshot
    await db.from('audit_logs').insert({
      actor_type: 'system', action: 'emergency_escalated',
      target_type: report.target_type, target_id: report.target_id,
      detail: { report_id: report.id, reporter_id: report.reporter_id, notes: report.notes, paged: sms },
    });

    // 3. auto-hide a reported plan pending review
    if (report.target_type === 'plan') {
      await db.from('plans').update({ is_hidden: true }).eq('id', report.target_id);
    }

    return json({ status: 'escalated', paged: sms }, 200);
  } catch (e) {
    console.error('[emergency-escalation] failure', e);
    // best-effort: never lose an emergency — enqueue a retry
    await db.from('pending_jobs').insert({
      job_type: 'emergency-escalation', payload: b, last_error: String(e),
      next_retry: new Date(Date.now() + 30_000).toISOString(),
    });
    return json({ status: 'enqueued_retry' }, 200);
  }
});
