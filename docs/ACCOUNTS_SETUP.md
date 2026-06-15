# HopOn — Accounts & Services Setup (ordered playbook)

Every external account/service the app needs, in dependency order. For each:
**what it's for · what to create · what to copy · where it goes** (→ see
`PROD_ENVIRONMENT_SETUP.md`). Cost noted where it applies.

> ⚠️ You create these (they need your identity / payment). Once the Supabase
> project + keys exist, the deploy/wiring can be automated (see end).

---

## 1. Supabase (hosted project) — 🔴 the foundation
- **For:** database, auth, storage, edge functions, cron.
- **Create:** a project at supabase.com (region close to users — e.g. Mumbai
  `ap-south-1`). **Pro plan** if you want daily backups/PITR.
- **Copy:** Project URL, `anon` key, `service_role` key, project **ref**, and the
  Functions base URL (`https://<ref>.functions.supabase.co`).
- **Goes to:**
  - App: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - DB settings: `app.settings.edge_base_url`, `app.settings.service_role_key`.
- **Then:** `supabase link`, `db push`, enable `pg_cron`+`pg_net`, deploy functions
  (PROD_ENVIRONMENT_SETUP §1–4). Enable **automated backups**.

## 2. Twilio (SMS) — 🔴 required (OTP login) + 🟡 founder paging
- **For:** phone-OTP sign-in (auth) and emergency founder SMS.
- **Create:** Twilio account → a **Messaging Service** (or sender number).
- **🇮🇳 India caveat:** A2P SMS to Indian numbers needs **DLT registration**
  (entity + sender ID + approved OTP template) before delivery works. Start this
  early — it has lead time. Test numbers work without it for staging.
- **Copy:** `Account SID`, `Auth Token`, Messaging Service SID / from number.
- **Goes to:**
  - Auth (OTP): Supabase **Auth → Phone provider** Twilio creds.
  - Edge secrets (paging): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- Also set `FOUNDER_ALERT_PHONE` (your on-call number) as an edge secret.

## 3. Google Cloud — 🔴 two APIs
One GCP project, two keys:
### 3a. Places API (New) — 🔴 location search
- **Enable:** "Places API (New)". Create an API key, **restrict it**: this API
  only + iOS bundle id (+ Android package later).
- **Copy → app:** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
### 3b. Cloud Vision API — 🔴 image moderation
- **Enable:** "Cloud Vision API". Create a key (server-side; no app restriction
  needed — it lives in an edge secret).
- **Copy → edge secret:** `GOOGLE_VISION_KEY`.
- ⚠️ Without this, the moderator **auto-approves every image** (no moderation).

## 4. Expo / EAS — 🔴 build + push
- **For:** building the app and delivering push notifications.
- **Create:** Expo account → an EAS project (`eas init`).
- **Copy → edge secret:** `EXPO_ACCESS_TOKEN` (Expo account settings → Access Tokens).
- **Configure push credentials** in EAS (APNs key for iOS, FCM for Android).

## 5. Apple Developer Program — 🔴 iOS (push + store)
- **Cost:** $99/yr. **For:** APNs (push), TestFlight, App Store.
- **Create:** enroll; create an **APNs key** (.p8) → add to EAS push credentials.
- **Needed for:** any real-device push test + App Store submission.

## 6. Google Play Console + Firebase (FCM) — 🟡 Android (when shipping Android)
- **Cost:** $25 one-time (Play). **For:** Android distribution + FCM push.
- **Create:** Firebase project → Android app → `google-services.json`; add the FCM
  server key to EAS. (Skip if iOS-only at launch.)

---

## Dependency order (do in this sequence)
1. **Supabase** (everything depends on it) → deploy schema + functions + settings.
2. **Google Cloud** (Places + Vision) → keys.
3. **Twilio** (+ start India DLT early) → auth + paging.
4. **Expo/EAS** + **Apple Developer** → real-device build + push.
5. **Google Play + FCM** → only when adding Android.

## After accounts exist — what can be automated
Given a linked Supabase project (CLI logged in) + the keys, the following can be
run for you (each is an outward/prod action — will confirm before running):
- `supabase db push` (schema/RLS/RPCs/migrations)
- enable `pg_cron` / `pg_net`; verify the 16 cron jobs
- set `app.settings.edge_base_url` + `service_role_key`
- `supabase functions deploy` (all 5) + `supabase secrets set` (Vision, Expo, Twilio, founder phone)
- write the app's prod env (EAS secrets / `.env.production`)
- run the post-deploy smoke (PROD_ENVIRONMENT_SETUP §9)

## Cost summary
| Service | Cost |
|---|---|
| Supabase Pro (backups) | ~$25/mo |
| Twilio | pay-per-SMS + number; DLT fees (IN) |
| Google Cloud (Places + Vision) | pay-per-use (free tiers exist) |
| Expo/EAS | free tier ok to start; paid for more builds |
| Apple Developer | $99/yr |
| Google Play | $25 one-time |
