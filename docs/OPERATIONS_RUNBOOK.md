# HopOn — Operations Runbook

Day-2 operations: how the background pipelines work, what to monitor, and how to
respond to common incidents. Pairs with `LAUNCH_CHECKLIST.md` and
`PROD_ENVIRONMENT_SETUP.md`. **Doc only — describes the as-built system.**

---

## 1. System map (background work)

```
client/app ──RPC──▶ Postgres ──triggers──▶ fn_dispatch_edge (net.http_post) ──▶ Edge Functions ──▶ external
                       │                         (needs app.settings.edge_base_url)
                       └── pg_cron (16 jobs) ── periodic functions
```

**Edge Functions**
- `image-moderator` — recap/story insert → Google Vision SafeSearch → approve/reject + audit.
- `push-sender` / `chat-push` — notification/message insert → Expo Push.
- `emergency-escalation` — emergency report → Twilio founder SMS + audit (+ plan auto-hide).
- `contacts-match` — invoked by the app (onboarding/invites); hashes only.

**Cron** — see LAUNCH_CHECKLIST §2 for the full table (resolve-attendance,
auto-end, suspension-expiry, hard-delete, moderation-redispatch are the critical 5).

---

## 2. Monitoring (what to watch)

| Signal | Query / source | Healthy |
|---|---|---|
| Stuck moderation | `select count(*) from recaps where moderation='pending' and created_at < now()-interval '15 min'` (same for stories) | ~0 |
| Cron health | `select jobname, schedule from cron.job;` (16 rows) · `select * from cron.job_run_details order by start_time desc limit 20;` | recent success rows |
| Dispatch failures | `select * from net._http_response order by created desc limit 50;` (non-2xx) | mostly 2xx |
| Emergency queue | `select * from reports where status='escalated' order by created_at desc;` + `pending_jobs` (retry queue) | reviewed promptly |
| Audit trail | `select action, count(*) from audit_logs group by 1 order by 2 desc;` | expected actions present |
| Suspensions | `select count(*) from users where account_status='suspended';` | expected |
| Push token health | `select platform, count(*) from push_tokens group by 1;` | growing with installs |

Set alerts on: pending-moderation backlog, cron job failures, `pending_jobs`
(emergency retry) growth, and a spike in `account_status_changed` audits.

---

## 3. Incident playbooks

### A. Recaps/stories stuck in "In review" (never approve)
**Cause:** dispatch not reaching the edge fn, or Vision misconfigured.
1. `select current_setting('app.settings.edge_base_url', true);` — empty → set it (PROD_ENVIRONMENT_SETUP §3). This is the #1 cause.
2. Check `net._http_response` for `image-moderator` calls (non-2xx?).
3. Check the function logs (`supabase functions logs image-moderator`) — missing `GOOGLE_VISION_KEY` → it **auto-passes** (so "stuck" usually = dispatch, not Vision).
4. Safety net: `hopon-moderation-redispatch` retries `pending` items >5 min old — confirm that cron is running.
5. Manual unblock (last resort): `select approve_recap('<id>')` / `reject_recap('<id>')` as service role.

### B. Push notifications not arriving
1. `edge_base_url` set? (§3). 2. `EXPO_ACCESS_TOKEN` secret set? 3. Real-device build with APNs/FCM? (no push on simulator). 4. `select count(*) from push_tokens where user_id=...` — token registered? 5. `supabase functions logs push-sender` — Expo errors? `DeviceNotRegistered` tokens are auto-pruned by the function + `hopon-token-prune`.

### C. Nobody can sign up / log in
**Cause:** auth Twilio misconfigured. Check Auth→Phone provider creds; confirm SMS
delivery in Twilio console. Ensure `[auth.sms.test_otp]` seed numbers are NOT the
only path. (OTP send/verify is GoTrue, not our code.)

### D. Suspensions never lift
Confirm `hopon-suspension-expiry` (hourly) is running; `fn_expire_suspensions`
reactivates rows where `suspended_until < now()`. Manual: `select set_account_status('<uid>','active')`.

### E. Trust scores / endorsements / familiar faces not appearing
By design they finalize ~48h post-plan via `hopon-resolve-attendance` (hourly) +
`hopon-auto-end`. Confirm both crons run. Check `attendance_resolutions` for the
plan. Nothing finalizes earlier — set expectations with support.

### F. Emergency report received
1. `select * from reports where status='escalated'` — triage. 2. Founder SMS
should have paged (Twilio); if `pending_jobs` has an `emergency-escalation` retry,
Twilio failed — check creds/`FOUNDER_ALERT_PHONE`. 3. Emergency on a **user** does
NOT auto-suspend (human-review decision) — act manually via `set_account_status`
if warranted. 4. Emergency on a **plan** auto-hides it (`is_hidden=true`).

### G. Moderation actions to do by hand (service role)
- Approve/reject content: `approve_recap/reject_recap/approve_story/reject_story('<id>')`.
- Suspend/ban: `set_account_status('<uid>','suspended'|'banned', '<reason>', <until?>)`.
- Hide a plan: `update plans set is_hidden=true where id='<id>'`.
All are service-role only; audit rows are written automatically where applicable.

---

## 4. Moderation thresholds (reference — auto-actions)
| Trigger | Threshold | Effect | Audit |
|---|---|---|---|
| user `safety_concern` reports | ≥3 distinct / 7d | 7-day suspend | account_status_changed |
| recap reports | ≥3 distinct | moderation=rejected | recap_auto_hidden |
| story reports | ≥3 distinct | moderation=rejected | story_auto_hidden |
| comment reports | ≥3 distinct | soft-delete | comment_auto_hidden |
| message reports | ≥3 distinct | soft-delete | message_auto_hidden |
| plan reports | ≥5 distinct | is_hidden=true | plan_auto_hidden |
| any `emergency` | 1 | status=escalated (+plan auto-hide) | emergency_escalated |
| reporter rate limit | 10/day | `rate_limited` error | — |
(Validated by the W6 safety gate — `docs/WAVE6_GATE_SAFETY.md`, 61/61.)

---

## 5. Account deletion lifecycle
1. User → `delete_account` → soft delete (`deleted_at`, `account_status='suspended'`),
   active hosted plans cancelled + members notified, contact_hashes/push_tokens removed,
   hidden from `users_public`. (30-day grace.)
2. `hopon-account-hard-delete` (daily 02:00) → `fn_hard_delete_accounts` anonymises
   in place at +30d: name `[deleted]`, random handle, PII cleared, `account_status='banned'`,
   auth phone/email nulled; deletes stories/recaps/likes/comments/follows/familiar_faces/
   feed_events/notifications; messages → `[deleted]`. **Trust graph (attendance_marks,
   endorsements) is preserved** so others' scores stay correct. Audit: `account_hard_deleted`.
> To honour an early-deletion request, backdate `deleted_at` (>30d) then run
> `select fn_hard_delete_accounts();` as service role.

---

## 6. Backup & restore
**Backups**
- Supabase automated daily backups (Pro) — confirm enabled + retention.
- PITR if on a supporting plan — confirm window.
- Storage objects backed up separately from the DB — confirm policy.

**Restore drill (do before launch, into staging):**
1. Create a staging project; restore the latest DB backup into it.
2. Re-point a staging app build at it; smoke per PROD_ENVIRONMENT_SETUP §9.
3. Verify storage objects resolve (recap/avatar URLs).
4. Document the actual RTO/RPO observed.

**Local/CI baseline (not a prod backup):** `supabase db reset` rebuilds the full
schema from migrations + seed; `supabase test db` runs 434 pgTAP; the multi-user
harness (`node scripts/validate_multiuser.mjs`, 67/67) and the safety gate
(`node scripts/gate_wave6_safety.mjs`, 61/61) validate behaviour on a clean DB.

---

## 7. Known operational caveats
- **Local dev ≠ prod:** `fn_dispatch_edge` no-ops locally (no `edge_base_url`), so
  moderation/push/emergency don't fire in dev — content is approved manually.
- **Avatars are not moderated** (image-moderator covers recaps/stories only).
- **Places key is client-embedded** — keep it API-restricted until the proxy lands.
- **Suspended users** keep a visible profile + still receive notifications
  (write-only restriction, by design); existing content is not retracted.
