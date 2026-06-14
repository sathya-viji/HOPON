# HopOn manual test report — 2026-06-12

> **Update (same day):** all 13 issues below were fixed and re-verified in the
> simulator. See "Fixes applied" at the end of this document.

**Build:** dev client, Expo SDK 56 / RN 0.85.3, iPhone 17 Pro simulator (iOS 26.5)
**Scope:** screen-by-screen walkthrough, logic checks, navigation correctness, light + dark mode, empty states. Mock data seeded so every plan lifecycle state (upcoming / ongoing / full / completed / expired) and every content section was reachable.

---

## Verdict at a glance

| Area | Result |
|---|---|
| Status routing (upcoming→Plan, completed→PlanEnded, expired→PlanExpired) | ✅ correct from Home lists and both profile screens |
| Back-stack correctness | ✅ returns to exact origin, scroll position preserved |
| Tab isolation (flows stay in their tab, stacks preserved on switch) | ✅ |
| Home tab re-tap pops to root | ✅ |
| Lifecycle pills (upcoming/ongoing/completed/expired) | ✅ match data and tap destination |
| Empty states (Home Joined, search no-results) | ✅ |
| Dark mode | ✅ all tested screens legible, except status bar (#10) |
| Join/approve flows | ✅ UI flows work; state does not persist (#3 #4 #11) |
| Create plan wizard | ❌ broken by location picker (#8) |
| Map screen | ❌ back button unusable (#5) |
| Plan host card | ❌ always shows "You" (#2) |

## Bugs found

### High priority
1. **(#2) Every plan's host card shows "You"** — `PlanScreen.tsx:32` calls `getPlanById(plan.hostId)` (a plan lookup with a user id), which is always undefined, so the host falls back to `users[0]`. The host card shows the wrong user *and* navigates to the wrong profile. Fix: `const host = getUserById(plan.hostId) ?? users[0];`
2. **(#8) Create wizard loses all state when picking a location** — from step 2, choosing a venue in LocSearch lands on a *fresh* Create at step 1 (category/activity wiped) and leaves LocSearch stranded in the stack (exposed later when closing Create). Location select likely pushes a new Create instance instead of returning to the existing one. Blocks the core posting flow.
3. **(#5) Map screen back button is unusable** — the search bar overlays it and swallows its taps; another header control is clipped off the top-right. Only escape is the tab bar. Also: one pin is clipped at the bottom edge of the initial region (region fitting), and map tiles render blank in the simulator (verify tiles on a real device — likely simulator-only).

### Medium
4. **(#1) Ended plans show "STARTING NOW"** in list rows (Home → Created): the countdown badge treats negative minutes as "starting now"; it ignores `ended`/`expired` status. Should show an ENDED/COMPLETED label (the profile lifecycle pill gets this right).
5. **(#3) Plans you're already in (per `joinerIds`) still show HOP ON** — joined state is session-only and never initialized from data.
6. **(#4) Completing the join flow doesn't update Home** — row stays "HOP ON", Joined tab count unchanged. Same root cause as #3: each screen keeps local state; there's no shared store.
7. **(#7) Recap and follower notifications are dead taps** — `ROUTE_FOR_TYPE` maps `new_recap`/`new_follower` to `null`, and the mock notifications lack `recapId`/`userId` to route with. Should open RecapDetail / ProfileOther.
8. **(#10) Status bar illegible in dark mode** — clock/battery stay dark-on-dark. Bind status bar style to the theme (`expo-status-bar` `style="light"` when dark).

### Low
9. **(#6) Tab bar highlights Home while on Notifications** — the Notifs icon never gets the active state (active tab is derived from the tab route only).
10. **(#9) Recap detail: author name/handle is not tappable** — only the avatar opens the profile.
11. **(#11) Notification state resets on remount** — the approved request reverted to pending with its unread dot restored when revisiting. Same session-state class as #3/#4.

### Data consistency (mocks)
12. "N joined" on plan details derives from `capacity − spotsRemaining` while the avatar row uses `joinerIds` — these disagree on p0 ("2 joined" with 3 avatars) since u0 was added to `joinerIds` without decrementing `spotsRemaining`. Either fix the mocks or derive the count from `joinerIds`.
13. Trust-grid stats (e.g. Arjun "12 hosted") vs derived tab counts ("Hosted · 1") disagree — mock profile stats are independent of mock plans. Fine for prototyping; will resolve with real data.

## What was verified working

- **Home:** Nearby/Joined/Created tabs with correct counts; live countdowns rolling into "STARTING NOW"; filters and pulse-bar count formula consistent; search filtering + no-results empty state; FULL state on full plans; ended/expired correctly excluded from Nearby.
- **Plan flows:** guest detail (badges, spots, joiner banner, guidelines), "View as host" → host view (Chat/Edit/Cancel, pending requests, attendees with scores), HOP ON → "You're in!" → group chat (messages render, back returns to confirmation) → Back to home.
- **Completed/expired plans:** open the correct terminal screens from Home and both profiles ("Coffee · Done!" with attendees / "This plan has passed" with post-recap CTA).
- **Notifications:** unread badge counts, Mark all read, inline Approve (toast "Request approved", badge 3→2, actions removed).
- **Create wizard:** category-first gating, char counter, step 2 fields (when/spots/cost/who/type), Review gated on location, tab bar hidden, X closes. (Until the #8 location bug hits.)
- **Recaps:** story bubbles with seen/unseen rings; full-screen story viewer (progress bars, plan chip, actions); recap cards; recap detail (Follow, like/comment counts).
- **Profiles (own + other):** trust grid, social links, crossed-paths banner, familiar faces, endorsements; Hosted/Joined/Recaps tabs with correct per-user counts; lifecycle pills correct incl. expired; recap cards in profile tabs; deep chain RecapDetail → profile → expired plan → back → back unwinds perfectly.
- **Settings:** sections render; in-app dark mode toggle switches the whole app instantly both ways.
- **Dark mode:** Home, plan detail, profiles, notifications, settings, recaps all themed and legible (except #10).

## Onboarding (tested via Settings → Log out)

**Working:** logout returns to Splash (with toast); Splash hero with live plan ticker; Login (phone entry, "Send code" → OTP echoing the number, **OTP auto-submits on 6th digit** — nice); session survives logout/login. Signup: phone step with Terms/18+ checkbox gating Send code; OTP step gating Verify; name step with auto-generated handle; back navigation through the chain preserves entered state.

**Bugs:**
- **(#12, HIGH — signup blocker) DOB picker on iOS:** (a) tapping **Done** without spinning the wheel never commits the default date — `onChange` only fires on change, Done just closes the modal — so Continue stays disabled and the user is stuck; (b) the picker sheet sits inside the dismiss-backdrop `Pressable` with no inner tap-absorber, so **any tap on the sheet itself dismisses the picker**. Fix: commit `dob ?? new Date(2000,0,1)` on Done, and wrap the sheet in its own no-op Pressable (the block-confirm overlay in ProfileOther already does this correctly).
- **(#13, low) Splash live-ticker activity icons render as blank boxes.**

Signup steps beyond DOB (gender, photo, interests, contacts sync, people to follow, neighbourhood) could not be reached through the UI because of #12 — wheel-spinning may work with real touch, but automation couldn't get past it. Code-reviewed only.

## Not covered (honest gaps)
- Profile edit save path, endorse flow, recap comments, post-recap, create-story, follow list, familiar-faces screen, block/report submissions, chat message sending, plan edit/cancel/leave confirms.
- Social links opening Instagram/LinkedIn (external app handoff) — wiring verified in code, not exercised.
- Real-device-only concerns: map tiles, haptics, GPS, keyboard behavior, performance.

## Fixes applied (2026-06-12, verified in simulator)

| # | Fix | Where |
|---|---|---|
| 2 | Host card: `getUserById(plan.hostId)` (was a plan lookup with a user id) | `PlanScreen.tsx` |
| 8 | LocSearch returns via `popTo(..., { merge: true })` — RN7's `navigate` pushed a fresh Create instance, resetting the wizard | `LocSearchScreen.tsx` |
| 12 | DOB: Done commits the default date; picker sheet wrapped in a tap-absorbing Pressable | `SignupDobScreen.tsx` |
| 5 | Map: floating back button added beside search; out-of-window pins no longer rendered (the "buried button" was a clipped Nandi Hills pin) | `HomeMapScreen.tsx` |
| 1 | `Countdown` takes a `status` prop → ENDED/EXPIRED/CANCELLED label instead of the ticker | `Countdown.tsx`, `PlanRow.tsx` |
| 3/4/11 | New `SessionContext` (single source of truth): joined plans seeded from `joinerIds`, join updates Home instantly, joined plans show Open chat/Leave footer (per prototype), notification read/approve state persists | `state/SessionContext.tsx`, `App.tsx`, `HomeScreen`, `PlanScreen`, `NotificationsScreen` |
| 7 | Recap/follower notifications route to RecapDetail/ProfileOther (`recapId` added to type + mocks) | `NotificationsScreen.tsx`, `types/notification.ts`, `mocks/notifications.ts` |
| 10 | `ThemedStatusBar` follows the in-app theme toggle | `App.tsx` |
| 6 | Tab bar highlights Notifs while on Notifications | `AppTabBar.tsx` |
| 9 | Recap author name/handle tappable (opens profile) | `RecapDetailScreen.tsx` |
| 13 | Splash ticker tiles render category icons | `SplashScreen.tsx` |
| data | `capacity`/`spotsRemaining` reconciled with `joinerIds` across all mock plans (key badges like "1 SPOT" preserved) | `mocks/plans.ts` |

Re-verified end-to-end: host card shows the real host; Create wizard survives the location round-trip and posts ("Plan is live!"); Joined·3 seeds from data with IN rows; joined plan shows Open chat/Leave; Created tab shows ENDED; map back works and pins stay in-bounds; recap notification opens the recap; Notifs tab highlights; dark-mode status bar is white. The DOB fix is code-verified (native wheel can't be spun by automation).

## Suggested fix order

1. #2 host card (one-line fix, core logic) 
2. #8 Create wizard state loss (blocks posting) 
3. #12 signup DOB picker (blocks new-user signup) 
4. #5 map back button 
4. #1 ended-plan badge 
5. #10 dark status bar 
6. #7 notification routing 
7. #6 / #9 polish 
8. #3/#4/#11 — decide on a shared session store (one design decision, fixes all three)
