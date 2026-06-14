# Wave 4 — Trust · Integration Report

**Date:** 2026-06-14
**Scope:** Wire the Trust layer onto the frozen Phase-4 backend — attendance
marking, peer/host endorsements, attendance score, familiar faces — across the
Endorse, PlanEnded, Profile, FamiliarFaces screens + HostCard/TrustGrid. UI
preserved (one contract-driven adaptation, noted). **No Wave 5.**

Test account: Arjun R (9999999992 / OTP 123452).

---

## 1. Status: ✅ Complete & fully validated

Host **and** peer endorse loops, the approved **auto-end cron**, and the
**get_plan_attendees** RPC are implemented and **device + DB verified**. `tsc`
exit 0; **400 pgTAP pass** (379 + 21 new); migrations apply cleanly from a
`db reset`. See §9 (Validation Pass) for the full trust-system verification.

> **Update (validation pass):** the two items previously flagged are now BUILT &
> approved — auto-end cron (migration 0014q) and get_plan_attendees (0014r).

---

## 2. Files changed
**New:** `src/api/trust.ts` (endPlan, submitEndorsements, voteHostNoshow,
getEndorsementSummary, getFamiliarFaces + types).

**Changed:**
- `src/screens/plan/EndorseScreen.tsx` — **rewritten**: host mode (mark
  present/no-show + one tag each) vs present-peer mode (tags only); lazy
  `end_plan` on host submit; `submit_endorsements`; loading / "host hasn't
  wrapped up" / window-closed states.
- `src/screens/plan/PlanEndedScreen.tsx` — real plan/attendees via
  `usePlanDetail`; role-aware CTA.
- `src/screens/profile/ProfileScreen.tsx` — real identity + TrustGrid score +
  endorsements (`get_endorsement_summary`) + familiar faces (`getFamiliarFaces`),
  focus-refetch. (Plan-history tabs + follow counts remain mock — Social wave.)
- `src/screens/profile/FamiliarFacesScreen.tsx` — real `getFamiliarFaces`
  (plans_together + last_met_at); Follow stays a local toggle (Social wave).
- `src/components/molecules/HostCard.tsx`, `TrustGrid.tsx` — null attendance → **"New"**.
- `src/screens/plan/PlanScreen.tsx` — FamiliarFacesBanner shows joiners who are
  the viewer's familiar faces (was `faces={[]}`).
- `src/utils/plan.ts` — `isWrappedUp()` + routing: a plan enters its Trust
  lifecycle ~1h after start (no manual "end" — see §4).
- `src/types/plan.ts` — `MemberStatus` += `'noshow'`.

---

## 3. Screens integrated
| Screen | Backend | Notes |
|---|---|---|
| Endorse (host) | `end_plan` (lazy) + `submit_endorsements` + `getPlanMembers` | mark present/no-show + one endorsement tag each |
| Endorse (peer) | `submit_endorsements` (tags) | tag-only; RPC-verified; attendee list best-effort (see §6) |
| PlanEnded | `get_plan_detail` | celebration + "mark attendance & endorse" / "endorse your crew" |
| Profile | `get_my_profile`, `get_endorsement_summary`, `getFamiliarFaces` | real identity + score + endorsements + faces |
| FamiliarFaces | `getFamiliarFaces` (own-row RLS) | real plans_together + last_met_at |
| HostCard / TrustGrid | — | null attendance → "New" |
| Plan detail banner | `getFamiliarFaces` ∩ joiners | "people you know are in" |

---

## 4. Lifecycle model (per your direction: no manual "End plan")
A plan **auto-enters its Trust lifecycle ~1h after its start time** (`isWrappedUp`).
There's no end-plan button. The host reaches Endorse via the `plan_ended_host`
notification; the host's **first attendance submission lazily calls `end_plan`**
(sets `ended_at`, marks host present, fires `plan_ended_*` notifications that prompt
the crew), then `submit_endorsements`. Peers can endorse once the host has wrapped
up (status `ended`) and they were marked present.

---

## 5. Validation results (device + DB)
**Host endorse loop — full E2E ✅** (plan "Sunday football", 3 members):
- Notification → Endorse (host mode); `getPlanMembers` listed all 3.
- Marked Ravi+Vikram present (+tags Punctual / Good energy), Meera no-show.
- Submit → DB: plan `status=ended` + `ended_at` set; attendance_marks
  Arjun/Ravi/Vikram present, Meera noshow; members attended/attended/noshow;
  endorsements Arjun→Ravi (Punctual), Arjun→Vikram (Good energy); **familiar_faces
  Arjun↔Ravi, Arjun↔Vikram** (Meera excluded as no-show); plans_hosted bumped.
- **Single-tag-per-person** enforced (see §6), no-show hides tags, "Mark all N"
  gating, "Done — submit" → `popToTop`.
- **Peer endorse (RPC-verified):** Ravi (present) endorsed Arjun "Great host" via
  `submit_endorsements` — guard satisfied; appeared in Arjun's summary.

**Data display ✅:**
- Profile: real identity (Arjun R / @arjun.blr / bio / 13 hosted / 36 met),
  **Endorsements "Great host · 1"**, **Familiar Faces (Ravi, Vikram)**,
  **TrustGrid ATTENDANCE → "New"** (score recomputed to null → the "New" treatment).
- FamiliarFaces screen: "1 plan together · Last met 1m ago" (real).

---

## 6. Bugs found / fixed
- No functional bugs. One **contract-driven UI adaptation**: endorsement tags are
  **single-select per person** (the `endorsements` table is `unique(plan_id,
  giver_id, receiver_id)` → one tag per receiver). The prototype's multi-select
  can't persist; single-select matches the backend (precedent: the Wave-2
  capacity-stepper removal). 🔧

## 7. Remaining issues by severity
**Critical/High/Medium:** none.

**Low / flagged (need your call — both additive backend):**
1. **Auto-end cron (product-behavior + new migration).** Your model is "plans
   auto-end ~1h after start and prompt everyone." The client does this for the
   *active* user (lazy end on host engagement + lifecycle routing). To prompt the
   host/members **proactively when the host never opens the app**, a backend cron
   must end past plans + fire `plan_ended_*`. That's a new migration + a
   product-behavior change → flagged, not built. **Confirm and I'll add it.**
2. **Peer attendee read (additive RPC + minor visibility change).** A present peer
   needs the list of co-attendees to endorse. Today peers source it from
   `get_plan_detail.joiners`, which drops members once the host marks them
   `attended` — so the peer list is best-effort. A clean fix is an additive
   `get_plan_attendees(plan_id)` SECURITY-DEFINER RPC (member-visible attendee
   list for ended plans) — a small visibility expansion. **Confirm and I'll add it.**
- (Carried) Session-restore needs `expo run:ios`; push untestable on sim; dev
  gear FAB overlaps bottom-right buttons (confirm `__DEV__`-gated).

## 8. Recommended next actions
1. Decide on the two flagged backend items (auto-end cron; peer-attendee RPC).
2. Proceed to **Wave 5 (Social)** when ready (Recaps, Stories, Follows,
   ProfileOther, FollowList) — this also unblocks the Profile plan-history tabs +
   follow counts left mock here.

> Wave 5 (Social) and beyond were **not** started.

---

## 9. Validation Pass (final trust-system verification)

### Files added/changed (this pass)
- **`supabase/migrations/20260614000002_0014q_auto_end.sql`** — `fn_end_plan_core`
  (shared end steps), `end_plan` refactored to delegate (contract unchanged),
  `fn_auto_end_plans()` cron fn (ends active/full plans `starts_at < now()-1h`),
  `fn_expire_plans` widened 10min→6h so it no longer pre-empts auto-end, pg_cron
  schedule `hopon-auto-end` (*/10, guarded).
- **`supabase/migrations/20260614000003_0014r_get_plan_attendees.sql`** — minimal
  read-only RPC; ended-plan + host/member gated, public fields only, caller &
  host-row excluded, endorsable statuses only.
- **`supabase/tests/0021_auto_end_attendees_test.sql`** — 21 pgTAP assertions.
- **`src/api/trust.ts`** — `getPlanAttendees`. **`EndorseScreen`** — peer list via
  `getPlanAttendees`; "Host didn't show up? Report" (`vote_host_noshow`).
  **`NotificationsScreen`** — `plan_ended_joiner` → Endorse.

### Tests added
- 21 pgTAP (file 0021): `fn_auto_end_plans` (ends 2h-old plan; future plan
  untouched; host row + present mark + `plan_ended_host`/`plan_ended_joiner`
  notifications), `get_plan_attendees` (grants, host/member visibility, host-row &
  self excluded, non-member→`not_member`, non-ended→`plan_not_ended`), and explicit
  **score progression (1→null, 2→null, 3→100, 4→75)**. Existing `end_plan` test
  (0008) still green after the refactor. **Total 400 pgTAP pass.**

### 1. Auto-end cron — ✅ E2E
Created an Arjun-hosted plan started 2h ago + 3 members → `fn_auto_end_plans()`
returned 1 → plan `ended`, `ended_at` set, synthetic host attended row + host
present mark, **`plan_ended_host` notification fired**. On device: re-login → the
notification **appeared in the Notification Center** → tap → **Endorse (host mode)**
with the 3 real attendees → marked all present → submit (already-ended path) →
members `attended`. Future plans were not auto-ended.

### 2. get_plan_attendees + peer endorse — ✅ E2E
Priya-hosted plan auto-ended; host marked Arjun + Meera present. As **Arjun (peer)**
on device: "Brunch club has ended. Endorse your crew" notification → **Endorse (peer
mode)**: "1 person" (Meera — self excluded), tags-only, "Host didn't show up? Report"
link. Tagged Meera "Good energy" → submit → endorsement **Arjun→Meera persisted**.

### 3. Attendance-score progression — ✅
pgTAP: 1 event → null (New), 2 → null, 3 → 100%, 4th (no-show) → 75%. UI: Arjun's
TrustGrid rendered **"New"** when his score recomputed to null. (Score-change
notifications fire only when old & new are both non-null — by design.)

### 4. Host no-show flow — ✅
Backend (pgTAP 0008): present attendee votes, quorum resolves host → `noshow`, host
**cannot vote** (`host_cannot_vote`), `host_marked_absent` notif + audit row. UI:
added "Host didn't show up? Report" in peer Endorse → `vote_host_noshow` + toast
(rendered on device).

### 5. Trust notifications — ✅
Verified generated + shown in the Notification Center with per-type icons + nav:
`plan_ended_host` → Endorse, `plan_ended_joiner` → Endorse, `new_familiar_face`
(seen: "You and Priya K/Ravi/Karan/Meera are now familiar faces"). `endorsement_received`,
`marked_noshow`, `attendance_score_improved/dropped`, `host_marked_absent` are
pgTAP-generated and render via the 41-type NotifRow map (Wave-3-verified); routes:
host_marked_absent→PlanHost, marked_noshow→Plan, score/endorsement→none (mark-read).
Empty state + offline behaviour unchanged (Wave 3).

### 6. Regression — ✅
400 pgTAP pass; `end_plan` unchanged-contract test green after refactor; tsc clean;
`db reset` applies 0014q+0014r in order. Wave 3 notification flows exercised
repeatedly during this pass (Notification Center load, badge updates, realtime/
refetch delivery of the auto-end notifications, mark-read) — no regressions.

### Bugs found / fixed
- None functional. Adjustment: `get_plan_attendees` excludes the caller (no
  self-endorse) — found while wiring peer mode, fixed in 0014r + test.

### Remaining known limitations
- Auto-end credits `plans_hosted` even for 0-attendee plans (reuses end_plan as
  directed); could route truly-empty plans to expire instead — product call, noted.
- Score-change notifications don't fire on first score appearance (null→value) — by
  the backend's design, not a bug.
- Carried (not Wave-4): session-restore needs `expo run:ios`; push untestable on
  sim; dev gear FAB overlaps bottom-right buttons (confirm `__DEV__`-gated);
  Profile plan-history tabs + follow counts still mock (Social wave).

### Final Wave 4 readiness: ✅ READY
The full Trust system — auto-end lifecycle, host/peer endorsements, attendance
scoring, familiar faces, no-show voting, and trust notifications — is implemented,
tested (400 pgTAP), and device-verified end-to-end. No Critical/High/Medium issues.
