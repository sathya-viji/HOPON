# HopOn — Post-Trust-Model Comprehensive Product Audit

**Date:** 2026-06-16 · **Type:** READ-ONLY product audit (no code changed) · **Scope:** Waves 1–7 + Trust V2 + morning resolve + pairwise familiar faces + auto-end lifecycle.

> **Method & integrity note.** This report contains only findings I actually verified. Each finding is tagged with how it was obtained:
> **[STATIC]** = source/migration/test analysis · **[DYNAMIC]** = executed against the local Supabase + seeded dataset · **[SIM]** = observed in the iOS simulator this session.
> **Environment limits (not fabricated around):** a full multi-device simulator matrix (iPhone SE/13/15/Pro Max, Android S/M/L), live VoiceOver/TalkBack runs, and instrumented color-contrast sampling were **not executed** — only one simulator (iPhone 17 Pro) was available and it was pointed at the prod backend. Those phases were covered by static responsive/a11y review + the screenshots captured earlier this session, and are clearly scoped as such in §2 and §13. No screenshots, device results, or measurements were invented.

---

## 0. Remediation Status (2026-06-16, post-audit)

After the audit, the findings were worked. Validated by `tsc` (clean), `get_user_plans` live check, and the full pgTAP suite (**457 PASS**).

| Finding | Status | What changed |
|---|---|---|
| **U4** Hosted tab empty | ✅ **FIXED** | New `get_user_plans` SECURITY DEFINER RPC (migration `0020`) + client `getUserHostedPlans` calls it. Live-verified. |
| **N2** dead-end Trust notifications | ✅ **FIXED** | `new_familiar_face` now carries the other user as actor (migration `0017`) → routes to `ProfileOther`; `endorsement_received` + `attendance_score_*` cross-tab to own `Profile`. |
| **A2** no Dynamic Type cap | ✅ **FIXED** | `maxFontSizeMultiplier={1.4}` applied centrally to all 16 `T.*` typography components. |
| **P1** unbounded chat fetch | ✅ **FIXED** | `getMessages` now bounded (`limit 100`, newest-first then reversed). |
| **U5** silent catches | ✅ **FIXED** | `SettingsScreen` (×3) + `SocialLinks` now `__DEV__`-warn. |
| **A3 / R-1 / V2** sub-token hitSlops | ✅ **FIXED (partial)** | `RecapsScreen` `4→spacing.md` (+label), `NavBar` `6→8`. |
| **A1** missing `accessibilityLabel` | 🟡 **PARTIAL** | `CreateScreen` (worst/core flow) fully labeled. *Remaining: ~39 controls in CreateStory, ProfileEdit, Profile, ProfileOther, PlanHost, StoryViewer.* (Note: the original count was a grep heuristic and slightly over-stated — several controls were already labeled.) |
| **U1/U2/U3** touch-hitbox / onboarding reflow / pill overflow | ✅ **FIXED** (earlier this session) | `Button`/`Tap`, onboarding `footer`, `HomeScreen` pill. U1 still needs **physical-Android confirmation**. |
| **N3** orphan screens (×7) | ⬜ **OPEN** | Dead code (low severity); removal touches navigators+types — left for a focused cleanup. |
| **U6** host-opens-Endorse ends plan | ⬜ **OPEN** | Needs a product decision (gate it), not a mechanical fix. |
| **V3/V4** hex-dup-tokens / `ReportFormScreen` naming | ⬜ **OPEN** | Cosmetic. |

---

## 1. Executive Summary

The backend is in strong shape (457 pgTAP passing, soak-validated) and the **Trust V2 lifecycle is correct end-to-end** — the morning resolver (`0 5 * * *` = 10:30 IST), the 6 h pickup buffer (plans ending shortly before 10:30 roll to the next morning), 2 h auto-end, and pairwise/self-no-show/block familiar-face pruning were all dynamically verified. The frontend architecture is disciplined (**zero `StyleSheet.create` in 61 screens** — the "screens own zero styles" rule is followed perfectly).

The most material issues are **navigation/safety reachability**, not correctness:

> **Correction (post-review):** an earlier draft flagged "users cannot report another user" as a HIGH safety blocker. **That was wrong** — `ProfileOtherScreen` reports a user via an inline `Alert.alert` → `submitReport('user', …)` (flag icon, line 138), which my navigation-target grep missed. Reporting a user **works**. The `ReportUser` *screen* is merely orphaned dead code (now N3h, LOW). The corrected single HIGH frontend blocker is U4.

| # | Severity | Finding |
|---|---|---|
| **U4** | **HIGH** | Other users' **"Hosted" tab is permanently empty** (`getUserHostedPlans` throws 42501, silently caught). |
| **N1→N3h** | LOW *(corrected)* | The `ReportUser` **screen** is orphaned (report-user actually works via an inline Alert in `ProfileOther`). |
| **N2** | MEDIUM | The flagship Trust V2 notifications (`new_familiar_face`, `endorsement_received`, `attendance_score_*`) are **dead-end taps** (null route). |
| **A1** | MEDIUM | Pervasive **missing `accessibilityLabel`** on interactive controls (entire screens have 0 labels). |
| **A2** | MEDIUM | **No Dynamic Type accommodation** — fixed-height controls will clip at large text. |
| **N3** | LOW | 6 **orphan screens** registered but never reached (`HomeEmpty`, `Search`, `PlanApproved`, `PlanEnded`, `PlanExpired`, `ProfileNew`). |
| **P1** | LOW–MED | Chat fetches **full history with no limit** (bounded by plan lifecycle, but unbounded query). |

Three high-impact UX-friction bugs were **found and fixed during this working session** (touch-hitbox dead-zone, onboarding keyboard reflow, location-pill overflow) — documented in §14 with status. They are real and would have been **P0/P1 at launch** in a pristine checkout.

**Launch readiness: NOT READY** until N1 (safety) and U4 (broken profile tab) are resolved; the rest are quality/polish. Details in §16.

---

## 2. Device Coverage

**Executed [SIM]:** iPhone 17 Pro (iOS 26.5) simulator — Home feed, Profile, Story viewer, onboarding screens observed rendering correctly this session.

**Not executed (environment limit):** iPhone SE / 13 / 15 / 15 Pro Max and Android small/medium/large. Spinning up and journey-driving 7 device simulators was not feasible in this session, and I did not fabricate per-device screenshots.

**Static responsive review [STATIC] (in lieu of the matrix):**
- Safe areas + keyboard are **centralized** in `components/layout/Screen.tsx` (`useSafeAreaInsets`, `KeyboardAwareScrollView`/`KeyboardAvoidingView`, `BottomTabBarHeightContext` for the tab inset) — this is the right pattern and means safe-area correctness is a property of one component, not 61 screens.
- Spacing/radii/typography are token-driven; text blocks use `maxWidth` caps; no hardcoded screen widths found.
- **Risk areas for small screens / large fonts:** fixed-height controls (inline buttons `minHeight: 32`, pills `height: 32`, settings rows `height: 36`) — see A2/A3.

**Confidence:** layout is *probably* sound across sizes given the centralized primitives, but this is **inference, not device-verified.** A real matrix pass is recommended before launch.

---

## 3. Dataset Statistics [DYNAMIC]

Seeded from `_soak/01_massgen.sql` + `01b_familiar.sql` onto a fresh local DB. Actual row counts:

| Entity | Target | Actual |
|---|---|---|
| Users | 1,000 | **1,006** |
| Plans | 2,000 | **2,004** |
| Plan memberships | 10,000 | **10,006** |
| Messages | 50,000 | **50,000** |
| Stories | 2,000 | **2,000** |
| Recaps | 2,000 | **2,000** |
| Notifications | 10,000 | **10,000** |
| Endorsements | 5,000 | **6,000** |
| Familiar faces | 5,000 | **8,100** |
| Reports | 1,000 | **1,000** |

Distributions are realistic (6 neighbourhoods, mixed verification levels, ~1% suspended / 0.5% banned, mixed moderation states). Dataset loaded cleanly with no constraint violations.

---

## 4. Onboarding Findings (Phase 2)

10-step flow: Login → OTP → Name(+live handle check) → DOB → Gender → Photo → Neighbourhood → Interests → Contacts → PeopleToFollow. Live validation (handle availability debounce, phone E.164, T&C gate) and cross-links (login↔signup) are present.

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| **U2** | MED | **CTA reflowed under the keyboard → first tap lost.** On keyboard-driven onboarding screens the Continue/Send/Verify button sat inside the keyboard-aware scroll body; when the keyboard dismissed, the button moved out from under the finger → "tap 2–3 times." | [STATIC]+[SIM] `SignupName/Phone/Otp`, `Login` | **FIXED this session** — CTAs moved to `Screen` `footer` (pinned above keyboard). Markers present in working tree. |
| O-1 | LOW | Several onboarding CTAs are `disabled` until an async check resolves (handle availability, `phoneRegistered`) with **no feedback on an early tap** — compounds the perception of unresponsiveness. | [STATIC] `SignupNameScreen` `canContinue` | Open (minor). |
| O-2 | INFO | `SignupPhoto` is skippable; avatar upload + contacts-match wiring is a documented later-wave follow-up. | [STATIC] PROJECT_STATUS | Expected. |

No blocking onboarding defects beyond U2 (fixed).

---

## 5. Plans Findings (Phase 3)

Create/Edit/Join/Leave/Cancel/Host-approval/Requests flows are present and wired via RPCs. `PlanScreen` dispatches by status to `PlanJoined`/`PlanRequested`/`PlanHost`/`Chat`/`PlanLeaveConfirm`.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **N3a** | LOW | `PlanApproved`, `PlanEnded`, `PlanExpired` screens are **registered but never reached.** `request_approved` notif routes to `Plan` (not `PlanApproved`); `plan_ended_*` route to `Endorse` (bypassing `PlanEnded`); `plan_expired_*` route to `PlanHost`/`Plan` (bypassing `PlanExpired`). | [STATIC] `NotificationsScreen.ROUTE_FOR_TYPE` + nav-target diff |
| PL-1 | INFO | Auto-end at **start + 2 h** verified live; `PlanScreen` join → `PlanRequested`/`PlanJoined` correct. | [DYNAMIC] cron + [STATIC] |

**Repro (N3a):** trigger a `request_approved` notification → tapping it opens `Plan`, never `PlanApproved`. The dedicated approval/ended/expired screens are dead code (either intended UX simplification or leftover — should be wired or removed).

---

## 6. Chat Findings (Phase 3)

`ChatScreen` uses a `FlatList` (windowed rendering — good) with realtime subscription.

| ID | Sev | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| **P1** | LOW–MED | `getMessages(planId)` fetches the **entire** plan history with **no `limit`/`range`** (the doc comment literally says "Full chat history"). Bounded in practice by the 10-member cap + short plan lifecycle, but it's an unbounded network fetch that grows with a busy plan. | [STATIC] `api/chat.ts:45-53` | Add a tail `limit` (e.g. last 50) + lazy older-message paging on scroll-up. Not launch-blocking. |

Rendering at scale is fine (FlatList). Realtime insert path maps `payload.new` to a typed `MessageRow` (the `as any` was removed in maintainability work).

---

## 7. Stories Findings (Phase 3)

Story viewer was reworked this session to **continuous cross-author playback** (Instagram-style) and verified [SIM] earlier (red→orange→amber → next author, etc.).

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| ST-1 | LOW | `CreateStoryScreen` has **8/8 Pressables with no `accessibilityLabel`** and several hardcoded hex (`#FF5C5C`, `#E0E0E0`, `#0A0A0A`) — partly within the documented "media-chrome" exception, but `#0A0A0A`/`#FFF0F0` duplicate existing tokens. | [STATIC] |
| ST-2 | INFO | Story expiry handled server-side (`get_stories_feed` filters `expires_at > now()`); viewer advances/clamps correctly. | [STATIC]+[SIM] |

---

## 8. Recaps Findings (Phase 3)

Create/View/Like/Comment/Report present; `RecapsScreen` has the story bubble rail + recap feed.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| R-1 | LOW | `RecapsScreen` uses raw `hitSlop={4}` (below the 8 token) on an action — small touch target. | [STATIC] `RecapsScreen.tsx:194` |
| R-2 | INFO | Recap moderation states handled; `RecapPost`/`RecapPosted` flow wired via `.replace`. | [STATIC] |

---

## 9. Profile Findings (Phase 3)

| ID | Sev | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| **U4** | **HIGH** | **Other users' "Hosted" tab is permanently empty.** `ProfileOtherScreen:79` calls `getUserHostedPlans(userId).catch(() => [])`; that function does a direct `plans` select that throws **42501** for `authenticated` in prod (documented in `api/plans.ts:271`), so the tab silently shows nothing for every other user. | [STATIC] `ProfileOtherScreen.tsx:79`, `api/plans.ts` | Add a `get_user_plans(p_user_id)` SECURITY DEFINER RPC (one-line extension of `get_my_plans`). |
| N3h | LOW *(corrected)* | Report-user **works** via an inline `Alert.alert` → `submitReport('user', userId)` (flag icon, `ProfileOtherScreen:117-139`). The dedicated `ReportUser` *screen* is orphaned dead code. Note the inconsistency: **report-plan navigates to a screen, report-user uses an Alert.** | [STATIC] `ProfileOtherScreen.tsx:117` | Remove the unused `ReportUser` screen, or unify both report flows on it. |
| P-1 | MED | `ProfileScreen` (5/5), `ProfileOtherScreen` (6/6), `ProfileEditScreen` (8/8) Pressables have **no `accessibilityLabel`.** | [STATIC] | — |
| P-2 | LOW | `ProfileNew` screen orphaned (no entry point). | [STATIC] | Wire or remove. |

---

## 10. Trust V2 Findings (Phase 4) — **ALL PASS** [DYNAMIC]

| Check | Result | Evidence |
|---|---|---|
| Morning resolver scheduled at 10:30 IST | ✅ `hopon-resolve-attendance` = `0 5 * * *` (05:00 UTC = 10:30 IST; India has no DST) | `cron.job` query |
| **Scenario A** — plan ends ~8 PM (20 h before run) | ✅ resolver-eligible → resolves next morning; endorsement open overnight; not resolved immediately | controlled tx query |
| **Scenario B** — plan ends 2 h before 10:30 | ✅ **NOT** eligible (within 6 h buffer) → rolls to the next morning | controlled tx query |
| Auto-end at start + 2 h | ✅ `hopon-auto-end` = `*/10 * * * *`, `starts_at < now() - 2h` | cron + migration |
| Familiar faces: default creation | ✅ | `0024` pgTAP green |
| Familiar faces: **pairwise** single-flag removal | ✅ flagged edge dropped, host edge survives (`pK`/`pM`) | `0024` pgTAP green |
| Familiar faces: self-no-show exclusion | ✅ excluded from all faces | `0024` pgTAP green |
| Familiar faces: block exclusion | ✅ blocked pair never connects | `0024` pgTAP green |
| Submission window closes on resolution (not 48 h) | ✅ | `0008`/`0019` |
| Score stays corroboration-gated (≥2) while graph is pairwise | ✅ graph/score diverge by design | `0022`/`0024` |

**No Trust V2 defects found.** One UX gap that touches Trust V2 lives in notifications (N2 below): the `new_familiar_face` notification — the payoff moment of the whole model — is a **dead-end tap**. The backend is correct; the *surfacing* is incomplete.

---

## 11. Notification Findings (Phase 5) [STATIC]

42 notification types mapped in `NotificationsScreen.ROUTE_FOR_TYPE`. Read/unread is handled (optimistic `markNotifRead`, `markAllNotifsRead`, focus refetch). Recap/profile types correctly route to `RecapDetail`/`ProfileOther`.

| ID | Sev | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| **N2** | MED | **Flagship features have dead-end notifications.** `new_familiar_face`, `endorsement_received`, `attendance_score_improved/dropped` all map to **`null`** — tapping does nothing. These are the most-promoted Trust V2 outcomes. | `ROUTE_FOR_TYPE` lines for those types | Route `new_familiar_face` → `ProfileOther(userId)`, `endorsement_received` → own `Profile`, `attendance_score_*` → own `Profile`. |
| N2b | LOW | `recap_liked`/`recap_commented` etc. route via `RECAP_TYPES` to `RecapDetail` only when `recapId` present; a missing `recapId` silently no-ops the tap. | `handleTap` | Fallback toast or disable affordance. |
| N-OK | INFO | `plan_*` types route correctly to plan-flow screens; approval/decline inline actions (`decide`) wired. | — | — |

---

## 12. Navigation Findings (Phase 7) [STATIC]

Full graph built from `navigation/types.ts` + the 4 navigators + all `navigate`/`replace`/nested-`screen`/notification-route targets.

**Reachability is mostly solid** (every stack has a back affordance; plan flow registered per-tab so back stays in-tab; no navigation loops found). But there is a cluster of **orphan screens** (registered + typed, zero entry points):

| ID | Sev | Orphan screen | Why it's unreachable | Impact |
|---|---|---|---|---|
| N3h | LOW *(corrected)* | `ReportUser` | No `navigate('ReportUser')` anywhere — **but report-user works** via an inline `Alert.alert` → `submitReport('user', …)` in `ProfileOther` (flag icon). The dedicated screen is just unused. | Dead code only. **Capability is present** (my earlier "cannot report a user" was wrong). Inconsistent with report-plan, which uses a screen. |
| N3b | LOW | `Search` | No `navigate('Search')`; Home uses an inline `SearchBar` instead. | Dead screen (inline search may suffice). |
| N3c | LOW | `HomeEmpty` | Never navigated; `HomeScreen` renders inline empty states. | Dead screen. |
| N3d | LOW | `PlanApproved` | `request_approved` routes to `Plan`. | Dead screen. |
| N3e | LOW | `PlanEnded` | `plan_ended_*` route to `Endorse`. | Dead screen (its "Endorse" button is the only nav out, but nothing reaches it). |
| N3f | LOW | `PlanExpired` | `plan_expired_*` route to `PlanHost`/`Plan`. | Dead screen. |
| N3g | LOW | `ProfileNew` | No entry point. | Dead screen. |

**Note (N3h):** the `ReportUser` screen and its param type exist and compile but are never navigated to — report-user is instead handled inline by an `Alert` in `ProfileOther`. So the screen is dead code, *not* a missing capability.

**No** dead-ends-without-back, broken route params, or navigation loops were found among reachable screens.

---

## 13. Accessibility Findings (Phase 8) [STATIC]

| ID | Sev | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| **A1** | MED | **Pervasive missing `accessibilityLabel`** on interactive controls. Worst offenders: `CreateScreen` 9/10 unlabeled, `CreateStoryScreen` 8/8, `ProfileEditScreen` 8/8, `StoryViewerScreen` 6/6, `ProfileOtherScreen` 6/6, `PlanHostScreen` 6/6, `ProfileScreen` 5/5. | per-file Pressable vs label grep | Add labels (VoiceOver/TalkBack reads "button" otherwise). |
| **A2** | MED | **No Dynamic Type handling.** `allowFontScaling` is never disabled (good — text scales), but **no `maxFontSizeMultiplier`** anywhere, and many **fixed-height** containers (inline buttons `32`, pills `32`, settings/history rows `36`, 34 px circular controls) will **clip/overflow at large text sizes.** | grep | Cap with `maxFontSizeMultiplier` on dense controls and/or let heights grow. |
| **A3** | LOW–MED | **Sub-44 touch targets.** Block `Button` is `minHeight: 44` (good), but inline join buttons (`32`), back/close circles (`34`), and `hitSlop={4}` controls fall below the 44×44 WCAG/Apple minimum. | tokens + grep | Standardize `hitSlop` to `spacing.sm`+ and raise inline mins. |
| A4 | INFO | **Contrast (not instrumented).** By token values, `textDim` `#BBBBBB` on `#FFFFFF` ≈ 1.9:1 and `textGhost` `#DDDDDD` fail WCAG AA for text — used for ghost/placeholder/disabled, which is borderline-acceptable but would fail an audit if used for meaningful text. | tokens (static estimate) | Verify with a contrast tool; reserve `textDim`/`textGhost` for non-essential text only. |

> Live screen-reader and instrumented contrast testing were **not executed** (environment limit) — A1–A3 are from static analysis; A4 is an estimate from token hex values, not a measurement.

---

## 14. UX Friction Findings (Phase 6)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| **U1** | **HIGH** | **Touch-target dead-zone ("tap 2–3 times").** `Button` and `Tap` wrapped a core `Pressable` in Reanimated's `Animated.createAnimatedComponent` + `transform: scale`; on the New-Architecture/Fabric Android build this **collapsed the native touch hitbox to the inner text**, so only the centre responded — every CTA and tappable row app-wide. | [STATIC]+[SIM]+device report | **FIXED this session** — plain `Pressable` is now the touch target with the scale on an inner `Animated.View` (`Button.tsx`, `Tap.tsx`). Markers present. **Was P0 pre-fix.** |
| **U2** | MED | Onboarding keyboard reflow (see §4). | | **FIXED this session.** |
| **U3** | LOW | Home **location pill overflowed/wrapped** with long neighbourhood names. | [STATIC]+[SIM] `HomeScreen` | **FIXED this session** (`maxWidth: 120` + ellipsize). |
| **U4** | HIGH | Other-user "Hosted" tab empty (see §9). | | Open. |
| U5 | LOW–MED | **Silent `.catch(() => {})`** swallows failures with no feedback: `SettingsScreen` (profile + invite stats ×3), `SocialLinks` (Linking). On failure the user sees stale/empty data silently. | grep | Add at least a dev `console.warn`; surface a retry on Settings. |
| U6 | INFO | The Endorse screen, when opened by a **host before auto-end**, calls `endPlan()` as a side-effect — a host tapping "Endorse" mid-event **ends the plan for everyone.** | [STATIC] `EndorseScreen.tsx:59` | Footgun; consider gating. (Not triggered in the normal notification-driven flow.) |

---

## 15. Visual Consistency Findings (Phase 9) [STATIC]

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **V1** | ✅ POSITIVE | **"Screens own zero styles" is followed perfectly** — `0` `StyleSheet.create` across all 61 screens; layout via primitives + tokens. Excellent maintainability posture. | grep |
| V2 | LOW | **`hitSlop` inconsistency** — mix of `spacing.sm` token and raw `4/6/8/10/12` across ~16 sites (SettingsNeighbourhood, RecapsScreen, CreateStory, onboarding, NavBar, SuspensionBanner, SearchBar…). | grep |
| V3 | LOW | **45 hardcoded hex in screens.** Most fall under the documented media-chrome exception (`HomeMapScreen` faux-map, `StoryViewer`/`CreateStory`) or are brand colors (`ProfileEdit` IG/LinkedIn/FB), but a few **duplicate tokens** (`#0A0A0A`=`colors.black`, `#FFF0F0`≈`surface`). | grep |
| V4 | LOW | **Naming:** `ReportFormScreen.tsx` exports `ReportForm` — a **shared component**, not a screen — yet lives in `screens/` with the `Screen.tsx` suffix. Mildly misleading. | imports |
| V5 | INFO | Loading-state coverage: **26/61 screens** use `ActivityIndicator`/skeleton. The remainder are static/result/settings screens that don't load data; spot-check found data screens (Plan, Profile, Chat, Endorse, Recaps) do show loaders. | grep |

---

## 16. Launch Readiness Assessment (Phase 10)

Judged as a first-time user + reviewer.

| Dimension | Verdict |
|---|---|
| Is the product understandable? | **Yes** — clear tab model (Home/Recaps/Profile), spontaneous-plan feed reads well. |
| Is onboarding smooth? | **Yes, after U2's fix.** 10 steps with live validation; the keyboard-tap bug (now fixed) was the main friction. |
| Is trust understandable? | **Partially.** The mechanics are sound and now surface familiar faces by default, but the **payoff notification is a dead-end** (N2) and there's no in-app explainer of what attendance/score/endorsements mean to a first-timer. |
| Is safety understandable? | **Yes.** Report-user (inline Alert in `ProfileOther`), report-plan (screen), report-problem, and block all work and are enforced; block is reflected in the familiar-faces graph. Minor inconsistency: report-user uses an Alert while report-plan uses a screen. |
| Is the social graph understandable? | **Partially** — familiar faces form correctly, but tapping the notification that announces them goes nowhere (N2), undercutting comprehension. |
| Is plan creation intuitive? | **Yes** — though `CreateScreen` is the worst a11y offender (9/10 unlabeled controls). |
| Is profile management intuitive? | **Mostly** — but other users' Hosted tab is silently empty (U4). |

### Launch gate

**Blockers (must fix before launch):**
1. **U4** — fix `getUserHostedPlans` (broken core profile surface) **or** explicitly hide the Hosted tab for other users.
2. Confirm **U1** (touch-hitbox) fix on a physical Android device — it was the single most severe UX defect and the fix is verified only by code review + iOS this session.

*(Former blocker "make report-user reachable" is withdrawn — report-user already works via the inline Alert in `ProfileOther`. See N3h.)*

**Strongly recommended before launch:**
4. **N2** — route the three flagship Trust V2 notifications.
5. **A1/A2** — accessibility labels + Dynamic Type caps (legal/quality risk).
6. Remove or wire the **6 orphan screens** (N3) to reduce confusion and dead code.

**Post-launch polish:** P1 (chat paging), U5 (silent catches), V2–V4 (consistency), the full device matrix + live a11y pass.

### Bottom line
Backend and Trust V2 are **launch-grade**. The frontend is architecturally clean and, after this session's three fixes, free of its worst interaction bug. The single remaining frontend launch-blocker is the **broken Hosted tab (U4)**; the Android touch-hitbox fix (U1) must also be **device-confirmed**. Safety (report/block) works. Everything else is quality/polish that can be sequenced after U4. *(An earlier draft over-stated a report-user safety blocker; corrected — see N3h.)*

---

## Appendix — Evidence index

- **Dataset:** `_soak/01_massgen.sql`, `01b_familiar.sql`; counts via `psql` on local `54322`.
- **Trust V2 dynamic:** `cron.job` schedule query; controlled rolled-back transaction for Scenarios A/B; `supabase test db` green (457 tests incl. `0022`, `0024`).
- **Navigation:** target diff of `navigate`/`replace`/nested-`screen`/`ROUTE_FOR_TYPE` vs registered `Stack.Screen` names.
- **A11y/visual:** per-file Pressable-vs-`accessibilityLabel` grep; `StyleSheet.create`/hex/`hitSlop`/`allowFontScaling` greps.
- **This-session fixes referenced:** `Button.tsx`, `Tap.tsx`, `HomeScreen.tsx`, onboarding `footer` screens, `StoryViewerScreen.tsx` (uncommitted working tree).
