# HopOn — Comprehensive Regression: Waves 1–3 (2026-06-14)

Scope: the fully-integrated app to date — Identity (W1), Core plan loop (W2),
Notifications + Chat + Realtime + push (W3). Validation, bug-fixing, stability,
edge cases. **No Wave 4. No new features. No UI redesign.**

Method: clean baseline via `supabase db reset` + `seed_dev_testdata.sql` +
`seed_dev_wave3.sql` (36 users, 34 plans / 32 future-active, Arjun 6 notifs / 4
unread, Dinner chat 3 msgs). Device = iOS 17 Pro simulator, account Arjun R
(9999999992 / OTP 123452). RPC-level checks via psql with JWT claims. `tsc`
exit 0; **379 pgTAP assertions pass** (no backend changes this pass).

Legend: ✅ pass · ⚠️ minor/limitation · ❌ bug · 🔧 fixed this pass

---

## 1. Launch-readiness assessment (Waves 1–3)

**READY for an internal/beta launch of the Waves 1–3 surface**, with two caveats
that need a **device build** to fully close (neither is a code defect):

- **Session restore after app restart** does not persist in the *current dev
  client* because the AsyncStorage native module isn't in the running binary →
  in-memory session store (per `client.ts`'s documented fallback). It restores
  fine once the dev client is rebuilt (`npx expo run:ios`). Re-login always works.
- **Push-token registration** is code-complete + guarded but **untestable on the
  simulator** (no APNs; native modules absent). Needs a physical device + rebuild.

Everything else — auth (login/logout/session establishment), the full plan loop,
notifications, chat, realtime, navigation robustness, and data-integrity /
idempotency — passes. One proactive stability fix was made (foreground refetch);
no functional defects were found.

---

## 2. Test matrix & results

### Authentication
| Case | Result | Notes |
|---|---|---|
| Login (phone OTP) | ✅ | feed loads, session established, notif badge restored |
| Logout | ✅ | Settings → Log out → landing immediately; session cleared |
| Session establishment | ✅ | SessionContext loads notifs + unread on login |
| Session restore after restart | ⚠️ | dropped on full reload — in-memory store in this dev build (needs `expo run:ios`); not a code bug |
| Expired session handling | ✅ | `autoRefreshToken` + AppState refresh wired (W1-verified); offline gate checks avoid getUser |
| Network failure during auth | ✅ | W1-verified (OTP send/verify error toasts) |

### Notifications
| Case | Result | Notes |
|---|---|---|
| Delivery + list | ✅ | `get_notifications`, server-rendered copy, 41-type icons |
| Unread badge updates | ✅ | login restore (→4), realtime bump (4→5/5→6), mark decrements |
| Mark read (tap) | ✅ | dot clears, count -1, persisted |
| Mark all read | ✅ | all dots clear, header + nav badge → 0, DB 0 unread |
| Duplicate prevention | ✅ | `mark_notifications_read` only flips unread=false; realtime refetch dedupes |
| Navigation targets | ✅ | mention → Chat; plan types → Plan/PlanHost/PlanRequests (41-type route map) |
| Realtime updates | ✅ | inserted notif appears at top instantly, badge bumps |
| Background → foreground | ✅ | badge recovered 4→5 for a notif inserted while backgrounded |
| Empty / offline | ✅ | EmptyState retained; load failure keeps prior state, no crash |

### Chat
| Case | Result | Notes |
|---|---|---|
| Open (from joined plan & notification) | ✅ | via "Open group chat" + mention notif |
| Send message | ✅ | `send_message`, input clears |
| Receive (realtime) | ✅ | psql-inserted message from another member appears live |
| Message ordering | ✅ | oldest→newest, auto-scroll to newest |
| Duplicate-tap protection | ✅ | `sending` guard + disabled send (code) |
| Empty messages | ✅ | client body-guard (no send); server `empty_message` mapped |
| Long messages | ✅* | backend caps 1–1000 chars (CHECK); not device-forced |
| Membership restrictions | ✅ | RLS: non-member reads **0** msgs; `send_message` → `not_member`; entry UI-gated |
| Offline send failure | ✅ | toast, draft retained, no message, no crash |
| Reconnect recovery | ✅ | same draft sends after gateway restored |
| Empty state | ✅ | "No messages yet — say hi 👋" on a fresh-chat plan |

### Plan-loop sanity
| Case | Result | Notes |
|---|---|---|
| Home feed | ✅ | NOW/THIS WEEK grouping, YOURS/HOP ON/IN/CLOSED/FULL/Women-only badges, counts |
| Join | ✅ | HOP ON → "You're in" → Joined·2→3, row → ✓ IN |
| Leave | ✅ | confirm → popToTop → Joined·3→2, row → HOP ON |
| Create | ✅ | entry + 3-step wizard loads (full create→PlanPosted W2-verified) |
| Approve / Decline | ✅ | device (W3) + RPC idempotency; persisted (Vikram approved / Anita declined) |
| Host view | ✅ | attendees + pending banner (W3 BUG #1 fix holds) |
| Search (plans) | ✅ | "Coffee" filters feed |
| People search | ✅ | "Meer" → PEOPLE (Meera Iyer + Sameer Ali), verified badge |
| Maps | ✅ | category pins by lat/lng, pin → plan card + HOP ON |
| Refresh/refetch | ✅ | focus-refetch reflects join/leave across Home/Detail |

### Navigation
| Case | Result | Notes |
|---|---|---|
| Deep navigation stacks | ✅ | Home→Plan→PlanJoined→Chat, clean |
| Rapid tab switching | ✅ | Home/Notifs/Recaps/Profile hammered — no crash/stuck state |
| Background/foreground | ✅ | app resumes correctly; badge refetches (fix below) |
| Back-stack correctness | ✅ | Chat→PlanJoined→Home; leave → popToTop |

### Data integrity / idempotency (RPC, `qa_idempotency_check.sql`)
| Case | Result | Behaviour |
|---|---|---|
| Join twice | ✅ | idempotent — 1 membership row, no error |
| Leave twice | ✅ | both no-op cleanly, 0 active rows |
| Approve twice | ✅ | 2nd → `request_not_found` (client: "no longer pending"), 1 approved row |
| Decline twice | ✅ | 2nd → `request_not_found`, status stays `declined` |
| Non-host approve | ✅ | rejected `not_host` |
| Retry after failure | ✅ | offline mutation/send fails gracefully, succeeds on reconnect |
| Concurrent actions | ✅* | guarded by transactional RPCs + `(plan_id,user_id)` unique + busy flags; not stress-load-tested |

---

## 3. Bugs found
- **None functional.** No integration/navigation/state/realtime/notification/chat/
  error-handling defect surfaced on the clean baseline.

## 4. Bugs fixed
- 🔧 **Notification badge could go stale after a long background.** The realtime
  socket can be suspended while backgrounded and does not replay inserts missed in
  that window, so the app-wide unread badge could lag until the next Notifications
  focus. **Fix:** added an `AppState`→`'active'` refetch in `SessionContext`
  (re-pulls feed + unread count on every foreground when signed in). State-mgmt /
  reconnect hardening; no UI/backend change. tsc clean. (The brief-background case
  already worked empirically; this closes the long-suspension edge.)

## 5. Remaining issues by severity
**Critical:** none.

**High:** none.

**Medium:** none.

**Low:**
- **Session does not survive a full app reload in the current dev client**
  (in-memory store; AsyncStorage native module not in this binary). Needs
  `npx expo run:ios` to persist. Re-login works. Not a code defect.
- **Push-token registration unverified end-to-end** — untestable on the simulator;
  needs a physical device + rebuild. Code guarded + ready.
- **In-app dev "gear" FAB overlaps bottom-right action buttons** (e.g. chat Send,
  Leave) and intercepted taps during automated testing. It's a `__DEV__` QA
  affordance (not shipped UI) — confirm it's gated out of production builds.
- Notification feed is first-page only (30); `get_notifications` `p_cursor`
  pagination not wired (matches prototype). Chat has no read-receipts/unread-
  per-chat (none in prototype). Both out of scope.

## 6. Recommended next actions
1. **Rebuild the dev client on a physical device** (`npx expo run:ios`) to (a)
   restore AsyncStorage session persistence and (b) verify push permission +
   `register_push_token` end-to-end with a real APNs token.
2. Confirm the dev gear FAB is `__DEV__`-gated so it never overlaps action buttons
   in production.
3. (Optional) Wire notification pagination if feeds grow long.
4. Proceed to **Wave 4 (Trust)** per INTEGRATION_PLAN.md when approved — not started.

---

## 7. Artifacts
- `supabase/qa_idempotency_check.sql` — reusable rollback-wrapped idempotency QA.
- `supabase/seed_dev_testdata.sql`, `supabase/seed_dev_wave3.sql` — deterministic
  dev dataset (re-runnable).
- Wave reports: `docs/WAVE2_REPORT.md`, `docs/WAVE3_REPORT.md`,
  `docs/REGRESSION_REPORT_2026-06-14.md` (post-onboarding pass + BUG #1 fix).

> Wave 4 (Trust), Wave 5 (Social), and other areas were **not** started.
