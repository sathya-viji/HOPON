# HopOn — Production Environment Setup

How to configure a hosted Supabase project + the Expo app for production. Pairs
with `LAUNCH_CHECKLIST.md` (what/why) and `OPERATIONS_RUNBOOK.md` (day-2).
**Audit/doc only — no commands have been run against any prod project.**

Assumes a linked hosted Supabase project (`supabase link --project-ref <ref>`).

---

## 1. Database schema & policies
```bash
supabase db push          # applies all migrations (schema, RLS, RPCs, storage RLS 0014t, growth 0012)
```
Verify: `select count(*) from pg_proc` sanity; spot-check `select * from pg_policies where schemaname='storage'`.

## 2. Extensions
Enable in the dashboard (Database → Extensions) or SQL:
```sql
create extension if not exists pg_cron;        -- REQUIRED — schedules all 16 jobs
create extension if not exists pg_net;          -- REQUIRED — fn_dispatch_edge uses net.http_post
-- pgcrypto/"extensions".digest is used by match_contact_hashes / is_feature_enabled (already present on Supabase)
```
> If `pg_cron` is enabled **after** migrations ran, re-run the cron-scheduling
> blocks (they're guarded `do $$ ... cron.schedule(...) ... $$`). Re-applying the
> relevant migrations or running the `cron.schedule(...)` statements manually
> (idempotent) is sufficient. Confirm with: `select jobname, schedule from cron.job;`
> (expect the 16 `hopon-*` jobs in LAUNCH_CHECKLIST §2).

## 3. DB settings for Edge dispatch  (the §0 switch)
`fn_dispatch_edge` reads two Postgres settings. Set them on the database so they
persist for every session/cron:
```sql
alter database postgres set app.settings.edge_base_url   = 'https://<project-ref>.functions.supabase.co';
alter database postgres set app.settings.service_role_key = '<service-role-key>';
```
> Without these, moderation/push/chat-push/emergency dispatch are **silent no-ops**.
> After setting, reconnect (settings apply to new sessions). Verify:
> `select current_setting('app.settings.edge_base_url', true);`

## 4. Edge Functions — deploy + secrets
```bash
supabase functions deploy image-moderator contacts-match push-sender chat-push emergency-escalation

supabase secrets set \
  GOOGLE_VISION_KEY='<vision-api-key>' \
  EXPO_ACCESS_TOKEN='<expo-access-token>' \
  TWILIO_ACCOUNT_SID='<sid>' TWILIO_AUTH_TOKEN='<token>' TWILIO_FROM_NUMBER='+1...' \
  FOUNDER_ALERT_PHONE='+91...'
```
> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` are injected by
> the platform — do not set manually.
> **GOOGLE_VISION_KEY is required for real moderation** — without it the function
> auto-passes every image. EXPO_ACCESS_TOKEN is required for push delivery.

## 5. Auth / OTP (Twilio for SMS sign-in) — REQUIRED
In the hosted project's **Auth → Providers → Phone** (or `config.toml` for
config-as-code deploys): set real Twilio `account_sid`, `auth_token`,
`message_service_sid`. **Remove the local `[auth.sms.test_otp]` numbers** — those
fixed-OTP seed numbers must not exist in prod.
Confirm: `jwt_expiry=3600`, refresh-token rotation on, `site_url=hopon://`,
redirect `hopon://auth-callback` (already in config.toml).

## 6. Storage buckets — REQUIRED
Create three **public** buckets matching `config.toml`:
| id | public | file size limit | allowed MIME |
|---|---|---|---|
| avatars | yes | 5 MiB | image/jpeg, image/png, image/webp |
| recaps | yes | 5 MiB | same |
| stories | yes | 10 MiB | same |
Write RLS (own-folder) ships in migration `0014t` — verify the 3 policies exist
(`app_own_folder_insert/update/delete`). Public read works via `getPublicUrl`.

## 7. Google Places — REQUIRED
- Create a Places API (New) key. **Restrict it**: API = "Places API (New)" only;
  application restriction = iOS bundle id (+ Android package when shipped).
- Put it in the app's prod env as `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
- (🟢 Post-launch) move calls behind a server proxy so the key isn't embedded.

## 8. Expo app build (EAS) — REQUIRED, device-only for push
- Set prod env in `eas.json` / EAS secrets: `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
- Configure push credentials: APNs key (iOS), FCM (Android). EAS project id set.
- Build a **real-device** build (`eas build`) — push + camera/contacts can only be
  validated on device, not the simulator.
- Pre-submit: `__DEV__`-gate the dev-gear FAB; confirm `app.json` perms strings
  (contacts, photos, notifications) are present and worded for review.

## 9. Post-deploy smoke (prod/staging)
1. OTP sign-up with a real number → lands in app (validates Twilio + auth).
2. Create a plan → appears in feed; join from a 2nd account.
3. Post a recap with a photo → uploads (validates buckets + storage RLS) → goes
   `pending` → **auto-approves within ~1 min** (validates dispatch + Vision) → feed.
4. Trigger a notification (follow/comment) → push arrives on device (validates
   push-sender + EXPO_ACCESS_TOKEN + APNs/FCM).
5. `select jobname from cron.job;` → 16 jobs present.
6. Submit an emergency report on a plan → founder SMS received + plan hidden.

---

## Reference — full secret/var inventory
| Where | Name | Required? |
|---|---|---|
| App (EXPO_PUBLIC) | SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_PLACES_API_KEY | 🔴 |
| DB settings | app.settings.edge_base_url, app.settings.service_role_key | 🔴 |
| Edge secrets | GOOGLE_VISION_KEY, EXPO_ACCESS_TOKEN | 🔴 |
| Edge secrets | TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER, FOUNDER_ALERT_PHONE | 🟡 |
| Auth config | Twilio SMS account_sid/auth_token/message_service_sid | 🔴 |
| Platform-injected | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (edge) | n/a |
