# Trust v2 — Implementation Report

**Date:** 2026-06-15
**Spec:** `docs/TRUST_V2_DESIGN.md` (locked). Peer-corroborated attendance:
everyone marks everyone (default-present), a 48h-close resolver turns marks into
one verdict per person (trust-weighted via a credibility floor; no-show needs ≥2
distinct credible flaggers; self-no-show authoritative + floor-exempt). Scoring,
endorsements, and familiar faces derive from RESOLVED attendance.

**Status:** ✅ Implemented, tested (**417 pgTAP pass**), device-verified end-to-end.

---

## 1. Files changed
**Migration** — `supabase/migrations/20260615000000_0014s_trust_v2.sql`:
- `attendance_marks` unique key → `(plan_id, marked_by, subject_id)` + `tag` column
  (staged endorsement, finalized at resolution).
- new `attendance_resolutions` (analytics: `eligible_marker_count`, `submission_count`).
- dropped `host_noshow_votes` + `vote_host_noshow` + `fn_endorsement_guard` trigger.
- `fn_marker_weight` (cold-start neutral; 0.5 credibility floor used by resolver).
- `fn_end_plan_core` — **dropped host auto-present** (no synthetic host row / present mark).
- `compute_attendance_score` — reads RESOLVED `plan_members` verdicts (not raw marks).
- `rebuild_familiar_faces` — pairs RESOLVED-present (`plan_members.status='attended'`).
- `submit_endorsements` — rewritten: any participant; default-present; tags staged;
  self-no-show drops the caller's tags; guards (not_member / plan_not_ended / 48h window).
- `fn_resolve_attendance()` + hourly cron `hopon-resolve-attendance`.
- `get_plan_attendees` — full participant set (host + members + self) for ended plans.

**Tests** — `supabase/tests/0022_trust_v2_resolver_test.sql` (28 assertions, full
matrix); `0007`/`0008`/`0021` updated to v2 semantics.

**Client** — `src/api/trust.ts` (`getPlanAttendees` returns `isHost`);
`src/screens/plan/EndorseScreen.tsx` (rewritten for the v2 default-present flow).

## 2. What changed (behaviour)
- No manual "End plan" and **no host auto-present** — a plan auto-ends ~1h after start
  (cron); the host's first Endorse submission lazily ends it as a fallback.
- **Everyone** (host + members + self) marks attendance, default-present, flag exceptions.
- Verdicts/scores/endorsements/familiar-faces are produced by the **48h resolver**, not
  at submit time. Endorsements appear ~2 days post-plan.
- `host_noshow` voting removed — the host is flagged like any other participant.

## 3. Validation results (focused regression)
**pgTAP:** 417 pass (incl. 0022's 28 v2 cases); `end_plan` v2 + guards (0008);
auto-end + `get_plan_attendees` v2 (0021); schema (0007). `db reset` applies the
full chain (0008→…→0014s) cleanly. `tsc --noEmit` exit 0.

| Required case | Covered |
|---|---|
| N=1 host-only | ✅ 0022 (UNRESOLVED) |
| N=2 dyad — both submit | ✅ 0022 (both PRESENT) |
| N=2 dyad — one submits | ✅ 0022 (both UNRESOLVED) |
| N≥3 group | ✅ 0022 + device |
| self-no-show (floor-exempt) | ✅ 0022 (sub-floor user → noshow; excluded from endorse/faces) |
| single no-show flag | ✅ 0022 (→ PRESENT) |
| two no-show flaggers | ✅ 0022 + device (→ NOSHOW) |
| credibility floor gating | ✅ 0022 (sub-floor flagger ignored) |
| score progression 1/2→New, 3→score, 4→update | ✅ 0022 |
| familiar faces rebuild | ✅ 0022 + device (no-show excluded) |
| endorsement eligibility (present↔present) | ✅ 0022 + device (self-no-show tag dropped) |
| idempotent re-resolution | ✅ 0022 (2nd run → 0) |
| late submission rejection | ✅ 0022 + 0008 (endorsement_window_closed) |
| participation metrics | ✅ 0022 (eligible/submission counts) |

**Device E2E (Arjun, "Morning hike", 3 people):** default-present list incl.
**Arjun · Host · You**; flagging self no-show → all endorsement controls hidden +
"endorsements are only available to attendees"; submitted (Arjun present, Meera
present + Punctual, Ravi no-show) → staged marks correct; after Meera corroborated
+ resolver ran: Arjun/Meera `attended`, **Ravi `noshow`** (2 flaggers), endorsements
Arjun↔Meera, familiar face Arjun↔Meera, metrics eligible=3/submission=2.

## 4. UI changes required (made)
- **Endorse screen rewritten** to one default-present flow for everyone: lists host +
  members + **self** (labelled "· Host" / "· You"), all pre-marked "Showed up", tap
  "No-show" to flag (incl. self). Same row/pill/tag visual system — no redesign.
- **Self-no-show** hides all endorsement-tag controls + shows an inline note.
- **Removed** the Wave-4 "Host didn't show up? Report" link (host-no-show voting retired).
- No other screens changed. (Profile/FamiliarFaces already read resolved data via the
  existing trust APIs — unchanged.)

## 5. Remaining limitations
- Scores/endorsements/faces finalize ~48h after a plan (by design).
- Auto-end credits `plans_hosted` even for 0-attendee plans (reuses end_plan) — noted.
- Carried (not Trust): session-restore needs `expo run:ios`; push untestable on sim;
  dev gear FAB overlaps bottom-right buttons (confirm `__DEV__`-gated).

## 6. Readiness: ✅ READY for review
No Critical/High/Medium issues. Trust v2 fully replaces v1 host-authoritative
attendance with the approved peer-corroborated model.
