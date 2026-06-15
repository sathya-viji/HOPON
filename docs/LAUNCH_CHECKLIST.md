# HopOn — Launch Checklist

**Audit date:** 2026-06-15 · **Scope:** Waves 1–7 complete; this is a config/ops
readiness audit (no code changes). Companion docs: `PROD_ENVIRONMENT_SETUP.md`
(how to set each item), `OPERATIONS_RUNBOOK.md` (day-2 ops).

**Classification legend**
- 🔴 **Required** — production is broken / unsafe without it.
- 🟡 **Recommended** — should be set for launch; degraded UX otherwise.
- 🟢 **Post-launch** — improvement; fine to defer.

**Flags**
- ⛔ **Fails in prod if unconfigured** — a hard failure (not just degraded).
- 💤 **No-op locally** — silently does nothing in local dev (so "works locally" ≠ "works in prod").
- 📱 **Device-only** — cannot be verified on the iOS simulator; needs a real device build.

---

## 0. The one switch most things depend on
**`app.settings.edge_base_url` + `app.settings.service_role_key`** (Postgres DB settings)
— 🔴 Required · ⛔ · 💤. `fn_dispatch_edge()` reads these; if unset it **returns
early (no-op)**. Everything that fires an Edge Function from the DB depends on it:
**moderation dispatch, push-sender, chat-push, emergency-escalation**. Locally
they're unset → content sits `pending` forever, no push, no founder paging. This
is the single highest-risk launch item. See PROD_ENVIRONMENT_SETUP §3.

---

## 1. Environment variables & secrets

### Client (Expo, `EXPO_PUBLIC_*` — embedded in the app bundle)
| Var | Class | Flags | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | 🔴 Required | ⛔ | App can't reach backend without it (throws at boot). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 🔴 Required | ⛔ | Same. |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | 🔴 Required | ⛔ | Location search/autocomplete (`src/api/places.ts`). Embedded client-side → **must be API-restricted** (Places API only + iOS bundle restriction) or proxied. See §8. |

### Edge Functions (Supabase secrets, `Deno.env`)
| Secret | Used by | Class | Flags |
|---|---|---|---|
| `SUPABASE_URL` | all edge fns | 🔴 Required | auto-injected by platform |
| `SUPABASE_SERVICE_ROLE_KEY` | all (service client) | 🔴 Required | auto-injected |
| `SUPABASE_ANON_KEY` | contacts-match (user client) | 🔴 Required | auto-injected |
| `GOOGLE_VISION_KEY` | image-moderator | 🔴 Required | ⛔💤 — **without it images AUTO-PASS** (no moderation). See §9. |
| `EXPO_ACCESS_TOKEN` | push-sender, chat-push | 🔴 Required | ⛔📱💤 — no push delivery without it. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | emergency-escalation | 🟡 Recommended | 💤 — founder SMS paging; skipped locally. |
| `FOUNDER_ALERT_PHONE` | emergency-escalation | 🟡 Recommended | 💤 — destination for emergency pages. |

### Auth SMS (OTP) — `config.toml [auth.sms.twilio]`
| Item | Class | Flags | Notes |
|---|---|---|---|
| Real Twilio `account_sid` / `auth_token` / `message_service_sid` | 🔴 Required | ⛔ | Local uses `AC_local_dummy` + `[auth.sms.test_otp]`. **Without real creds in prod, no OTP SMS → nobody can sign up or log in.** Separate from the edge-fn Twilio (may reuse the same account). |
| Remove/disable `[auth.sms.test_otp]` numbers for prod | 🔴 Required | — | The seeded test numbers (+91999999999X → fixed OTPs) must not exist in prod. |

---

## 2. Cron jobs (pg_cron) — 16 scheduled jobs
**`pg_cron` extension must be enabled in prod** (🔴 Required ⛔💤). Each
`cron.schedule()` is guarded by `if pg_extension pg_cron exists` and raises a
NOTICE (skips) otherwise — so if pg_cron is off, **none** of these run.

| Job | Cadence | Function | Class | Impact if not running |
|---|---|---|---|---|
| `hopon-resolve-attendance` | `7 * * * *` | fn_resolve_attendance | 🔴 | Trust scores / endorsements / familiar-faces **never finalize** (48h resolver) |
| `hopon-auto-end` | `*/10` | fn_auto_end_plans | 🔴 | Plans never auto-end → trust lifecycle stalls |
| `hopon-suspension-expiry` | `0 * * * *` | fn_expire_suspensions | 🔴 | Suspensions **never lift** (permanent) |
| `hopon-account-hard-delete` | `0 2 * * *` | fn_hard_delete_accounts | 🔴 | Soft-deleted accounts never anonymised (data-retention/GDPR) |
| `hopon-moderation-redispatch` | `*/5` | fn_redispatch_stale_moderation | 🔴 | Stuck `pending` content never retried (safety net) |
| `hopon-expiry` | `*/10` | fn_expire_plans | 🟡 | Past plans not marked expired |
| `hopon-story-cleanup` | `0 * * * *` | fn_cleanup_stories | 🟡 | Expired stories not purged (still hidden by RLS, just not deleted) |
| `hopon-like-batch` | `0 * * * *` | fn_flush_like_batches | 🟡 | Batched "N new likes" notifications not sent |
| `hopon-starting-60` | `*/5` | fn_notify_starting_60 | 🟡 | "Starts in 1h" reminders not sent |
| `hopon-starting-15` | `*/2` | fn_notify_starting_15 | 🟡 | "Starts in 15m" reminders not sent |
| `hopon-started-5` | `*/5` | fn_notify_started_5 | 🟡 | "Plan started" nudges not sent |
| `hopon-token-prune` | `0 3 * * *` | fn_prune_push_tokens | 🟡 | Stale push tokens accumulate |
| `hopon-story-expiring` | `*/30` | fn_notify_story_expiring | 🟢 | "Story expiring" nudge not sent |
| `hopon-recap-reminder` | `*/15` | fn_notify_recap_reminder | 🟢 | "Post a recap" nudge not sent |
| `hopon-nudge-profile` | `0 9 * * *` | fn_notify_profile_incomplete | 🟢 | Profile-completion nudge not sent |
| `hopon-nudge-first-plan` | `0 10 * * *` | fn_notify_first_plan | 🟢 | First-plan nudge not sent |

---

## 3. Edge Functions (5) — deploy + configure
All require deployment (`supabase functions deploy`) **and** §0 (so the DB can reach them) / their secrets.
| Function | Trigger | Class | Flags |
|---|---|---|---|
| `image-moderator` | recap/story insert → dispatch + redispatch cron | 🔴 Required | ⛔💤 needs GOOGLE_VISION_KEY |
| `contacts-match` | client `functions.invoke` (onboarding/invites) | 🔴 Required | — (works locally; called directly by app) |
| `push-sender` | notification insert → dispatch | 🔴 Required | ⛔📱💤 needs EXPO_ACCESS_TOKEN |
| `chat-push` | message insert → dispatch | 🟡 Recommended | 📱💤 |
| `emergency-escalation` | emergency report dispatch | 🟡 Recommended | 💤 needs Twilio + FOUNDER_ALERT_PHONE |

---

## 4. Storage buckets
| Bucket | Public | Limit | MIME | Class | Notes |
|---|---|---|---|---|---|
| `avatars` | yes | 5 MB | jpeg/png/webp | 🔴 Required | own-folder write RLS (migration 0014t). ⚠️ avatars are **not** moderated (image-moderator covers recaps/stories only). |
| `recaps` | yes | 5 MB | jpeg/png/webp | 🔴 Required | own-folder write RLS |
| `stories` | yes | 10 MB | jpeg/png/webp | 🔴 Required | own-folder write RLS |

⛔ Buckets are declared in `config.toml [storage.buckets.*]` (applied by the local
CLI). **On the hosted project they must exist with the same public/MIME/size
config** or uploads fail. Write RLS ships in migration `0014t`.

---

## 5. Push notification setup — 🔴 Required · 📱 · ⛔💤
- Real-device build with APNs (iOS) / FCM (Android) — **cannot be tested on the
  simulator** (no push tokens issued). Client registers via `register_push_token`.
- Delivery path: notification/message insert → `fn_dispatch_edge('push-sender'|'chat-push')`
  → Expo Push API (needs `EXPO_ACCESS_TOKEN`). Depends on §0.
- EAS project / Expo push credentials configured.

## 6. Twilio
- **OTP (auth):** real Twilio creds in `config.toml [auth.sms.twilio]` — 🔴 Required ⛔ (blocks all auth otherwise).
- **Founder paging (emergency):** `TWILIO_*` + `FOUNDER_ALERT_PHONE` edge secrets — 🟡 Recommended.

## 7. Google Places — 🔴 Required · ⛔
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` powers location search/autocomplete.
- **Security:** key is client-embedded. Restrict it (Places API only + iOS bundle id).
  A server-side proxy was noted as a deferred improvement (🟢 Post-launch) — see places.ts header.

## 8. Moderation pipeline — 🔴 Required · ⛔💤
recap/story insert → `moderation='pending'` → trigger `fn_dispatch_edge('image-moderator')`
→ Google Vision SafeSearch → `approve_*`/`reject_*` + audit; `hopon-moderation-redispatch`
retries stragglers. **Two prod must-haves:** §0 (else never dispatched → stuck pending)
AND `GOOGLE_VISION_KEY` (else **auto-pass = no moderation**). In-app "in review" UX exists.

## 9. Emergency escalation pipeline — 🟡 Recommended · 💤
emergency report → trigger forces `status='escalated'` (in-DB, always) → dispatch
`emergency-escalation` → founder SMS (Twilio) + `emergency_escalated` audit + (if a
plan) auto-hide. In-DB escalation works without config; **paging + plan auto-hide
need §0 + Twilio.** (Decision: emergency on a *user* pages only — no auto-suspend.)

## 10. Backup & restore — 🔴 Required
- Enable Supabase **automated daily backups** (Pro plan) + verify **PITR** if on a
  plan that supports it.
- Storage objects (buckets) are backed up separately from the DB — confirm the
  storage backup/retention policy.
- **Test a restore** into a staging project before launch (see OPERATIONS_RUNBOOK §Backup/Restore).

---

## 11. Things currently NO-OP in local dev (💤)
- All DB→Edge dispatch (`fn_dispatch_edge`) — `edge_base_url` unset locally → moderation, push, chat-push, emergency all silently skip. **(Content stays `pending`; we approve manually in dev.)**
- `image-moderator` auto-passes (no `GOOGLE_VISION_KEY`).
- Twilio: OTP uses `[auth.sms.test_otp]` fixed codes; founder SMS skipped.
- `pg_cron` jobs only run if the extension is enabled in the local stack (verify per environment).

## 12. Simulator-tested but NOT real-device tested (📱)
- Push notifications (no tokens on simulator) — **untested end-to-end.**
- Camera/photo-library capture for avatar/recap/story (upload path proven via REST; native picker proven on sim, but real-device camera + HEIC handling untested).
- Contacts sync + invites (sim has sample contacts; real-device contact volume/format untested — note `normalizePhone` defaults bare numbers to +91).
- Onboarding contacts→follow flow end-to-end (reaching it needs a fresh signup; pipeline proven via edge-fn probe, not a full device run).

## 13. Would FAIL in production if not configured (⛔ summary)
1. `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` missing → app won't boot.
2. Auth Twilio missing → **no OTP → no signup/login** (total block).
3. `edge_base_url`/`service_role_key` DB settings missing → no moderation (content stuck `pending`), no push, no emergency paging.
4. `GOOGLE_VISION_KEY` missing → **all images auto-approve** (moderation bypass — safety/legal risk).
5. `EXPO_ACCESS_TOKEN` missing → no push delivery.
6. `pg_cron` disabled → no trust resolution, no suspension expiry, no hard-delete, no plan expiry.
7. `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` missing/unrestricted → no location search / key abuse.
8. Storage buckets not provisioned on the hosted project → all uploads fail.
9. Test-OTP numbers left enabled → security hole.

---

## 14. Non-config launch items (tracked elsewhere)
- 🟡 Suspended-state global banner (client can't read own `account_status` — decision pending; enforcement proven by W6 gate).
- 🟢 `__DEV__`-gate the dev-gear FAB (overlaps bottom-right buttons in dev builds).
- 🟢 `ProfileIncomplete` decorative avatars still from mocks (cosmetic).
- 🟢 Places server-side proxy (key hardening).
