# Wave 3 — Notifications + Chat + Realtime · Integration Report

**Date:** 2026-06-14
**Scope:** Wire notifications, the notification center, unread counts, plan group
chat, the realtime subscriptions those screens need, and push-token registration
onto the frozen backend (Phase 3). No schema/migration/RPC/RLS changes — only the
client + dev test-data. UI preserved exactly (no redesigns/animations/layout/colour
changes).

Test account: Arjun R (9999999992 / OTP 123452).

---

## 1. Status: ✅ Complete (push-token registration code-complete, untestable on simulator)

All in-scope screens are wired to real backend RPCs + realtime and verified on the
iOS simulator against the local Supabase stack. `tsc --noEmit` exit 0. **379 pgTAP
assertions still pass** (no backend changes this wave). No blocking issues.

---

## 2. Files changed

### New — API / services
- `src/api/notifications.ts` — `getNotifications`, `getUnreadCount` (own-row COUNT),
  `markNotificationsRead`, `registerPushToken` + row→`Notification` mapper.
- `src/api/chat.ts` — `getMessages` (direct RLS read), `sendMessage` (RPC),
  `mapMessageRow`; raw `ChatMessageRaw` (author resolved by the screen).
- `src/api/realtime.ts` — `subscribeToPlanMessages(planId)`,
  `subscribeToNotifications(userId)` (postgres_changes; return unsubscribe fns).
- `src/services/push.ts` — guarded push-token registration (see §5).

### Changed — screens / state / nav / types
- `src/state/SessionContext.tsx` — **rewritten** from a mock-notif store into the
  real notification provider: loads via RPC, keeps unread count, subscribes to
  realtime (refetch on insert), optimistic mark-read reconciled to RPC,
  auth-aware (re)load/(re)subscribe, fires guarded push registration on login.
- `src/screens/notifications/NotificationsScreen.tsx` — real data; `ROUTE_FOR_TYPE`
  expanded to all 41 types; tap = mark-read + navigate; inline approve/decline call
  `approve_request`/`decline_request`; loading state; focus-refetch.
- `src/components/molecules/NotifRow.tsx` — `TYPE_ICON` expanded 7→41 types (existing
  icons + colours only) + a safe fallback; `plan_ended`→`plan_ended_host`.
- `src/screens/chat/ChatScreen.tsx` — **rewritten** off mocks: plan header from
  `usePlanDetail`, history + realtime, send via RPC, author resolution from plan
  detail, dedupe-by-id, dup-tap guard, offline-fail toast + draft retained,
  auto-scroll to newest.
- `src/navigation/AppTabBar.tsx` — feeds `unreadCount` into the existing NavBar
  `badges.notifications` slot (the badge UI already existed).
- `src/types/notification.ts` — `NotifType` expanded to the backend's 41-value enum.
- `src/api/errors.ts` — added `empty_message`, `message_not_found` mappings.
- `src/mocks/notifications.ts` — two stale type literals realigned to valid enum
  values (mock retained only for type-compat; not used by the screen anymore).

### New — dev test data (no migration)
- `supabase/seed_dev_wave3.sql` — re-runnable: 6 notifications for Arjun (mixed
  read/unread + a mention) and 3 chat messages on Dinner meetup.

### Dependencies
- `expo-notifications`, `expo-device` (via `expo install`, SDK-56 compatible) — for
  push-token registration only; lazy-required + presence-guarded (§5).

---

## 3. Screens integrated
| Screen | Backend | Notes |
|---|---|---|
| Notifications (center) | `get_notifications`, `mark_notifications_read` | 41-type icons, server-rendered copy, inline approve/decline, mark-all |
| Bottom-nav unread badge | own-row notifications COUNT | existing NavBar BadgePill, fed real count |
| Chat (plan group) | `messages` (RLS read) + `send_message` | realtime, author resolution, lock/membership via server errors |
| (Push registration) | `register_push_token` | guarded service, fires on login (see §5) |

---

## 4. Realtime architecture
- **Transport:** Supabase `postgres_changes` over the `supabase_realtime` publication
  (migration 0015a already publishes `notifications`, `messages`, `plan_members`).
- **Chat channel** `plan:{id}:messages` — INSERT on `messages` filtered by `plan_id`.
  The screen maps the raw row (it already holds author profiles from plan detail) and
  **dedupes by id**, so the local send-echo and the realtime broadcast never double up.
- **Notifications channel** `user:{id}:notifications` — INSERT on `notifications`
  filtered by `user_id`. The realtime row lacks the embedded actor profile, so on fire
  the provider **refetches** the enriched feed + unread count (notifications are
  low-volume; correctness over micro-optimisation).
- **Lifecycle:** each subscribe returns an unsubscribe fn; ChatScreen cleans up on
  unmount, SessionContext re-wires the notifications channel on auth change and
  unsubscribes on sign-out. No channel leaks.

---

## 5. Push-token registration (guarded; untestable on simulator)
`src/services/push.ts` requests notification permission and registers the native
device token via `register_push_token`, fired once per session from SessionContext on
login. It is **fully guarded**: it presence-checks the native modules with
expo-modules-core's `requireOptionalNativeModule('ExpoDevice'/'ExpoPushTokenManager')`
**before** importing expo-device/expo-notifications, then skips if not a physical
device. On the simulator (native modules absent) it logs a single skip line and
no-ops — **no crash, no red-box** (verified; an earlier import-first version did
red-box, which is why the presence-check guard was added). Real registration requires
a **physical device + a dev-client rebuild** (`npx expo run:ios`) that includes
expo-notifications, so it could not be exercised end-to-end here.

---

## 6. Validation results (iOS simulator + DB)

### Notifications
| Case | Result |
|---|---|
| List loads (real data, server copy, 41-type icons) | ✅ 7 notifs incl. a backend-generated `plan_expired_host` |
| Unread count (header + nav badge) | ✅ badge "5", live |
| Mark-read (tap) | ✅ dot clears, count decrements, persisted |
| Mark all read | ✅ all dots clear, badge → 0, DB: 0 unread / 8 |
| Realtime delivery | ✅ inserted notif appeared at top instantly, badge 5→6, no refresh |
| Inline approve/decline | ✅ approve→ `approve_request` (Vikram=approved in DB), row marked read |
| Nav targets | ✅ mention → Chat; plan types → Plan/PlanHost/PlanRequests (route map) |
| Empty / offline | ✅ EmptyState retained; load failure keeps prior state (no crash) |

### Chat
| Case | Result |
|---|---|
| Open from notification / plan | ✅ via mention notif + plan entry points |
| History loads + author resolution | ✅ Meera left/avatar, Arjun (host/self) right coral |
| Send message | ✅ posts + clears input (RPC `send_message`) |
| Receive (realtime) | ✅ Meera's inserted message appeared live at bottom |
| Message ordering | ✅ oldest→newest, auto-scroll to newest |
| Offline send failure | ✅ toast, draft retained, no message, no crash |
| Recovery after reconnect | ✅ same draft sent successfully after gateway restored |
| Duplicate-tap protection | ✅ `sending` guard + disabled send (code) |
| Membership restriction | ✅ RLS: non-member reads **0** messages; `send_message` raises `not_member`; entry UI-gated |

### Cross-screen
| Case | Result |
|---|---|
| Notification → correct screen | ✅ (mention→Chat verified; plan routes mapped) |
| Plan/Home reflect actions | ✅ approve from notif persists; detail/host use focus-refetch |
| Unread badge app-wide | ✅ SessionContext drives AppTabBar badge |

---

## 7. Bugs found / fixed (this wave)
- **Push red-box on simulator (found + fixed):** importing expo-device when the native
  module isn't in the binary surfaced an "Uncaught Error" red-box (expo-modules-core
  reports to LogBox even when caught). Fixed by presence-checking via
  `requireOptionalNativeModule` before importing. App now runnable on the simulator.
- No other defects. (The sim's in-memory session store still drops the session on a
  full reload — pre-existing env gotcha, not a Wave 3 issue; re-login restores it.)

## 8. Remaining issues by severity
- **Critical:** none.
- **High:** none.
- **Medium:** none.
- **Low:**
  - Push-token registration is **unverified end-to-end** — untestable on the simulator;
    needs a physical device + dev-client rebuild. Code is guarded and ready.
  - Chat has no per-message delivery/read receipts or unread-per-chat indicator — none
    exist in the prototype; out of scope (no UI to populate).
  - Notification list is first-page only (30) with no infinite-scroll pagination wired
    (RPC supports `p_cursor`); acceptable for now, matches prototype.

## 9. Recommended next actions
1. On a physical device, rebuild the dev client (`npx expo run:ios`) and verify push
   permission prompt + `register_push_token` writes a row; then test a real push via the
   backend's chat-push / notification webhooks.
2. (Optional) Wire notification list pagination (`get_notifications` `p_cursor`) if the
   feed grows long.
3. Proceed to **Wave 4 (Trust)** per INTEGRATION_PLAN.md when ready. Re-apply the
   one-screen-at-a-time review rule.

> Per instructions, Wave 4 (Trust), Wave 5 (Social), and other feature areas were **not**
> started. This wave stayed within notifications + chat + realtime + push registration.
