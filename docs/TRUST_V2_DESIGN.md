# Trust v2 — Peer-Corroborated Attendance (design for sign-off)

**Status:** DRAFT — awaiting approval. No code until signed off.
**Why:** v1 is host-authoritative (only the host marks attendance). That's fragile
(lazy/absent/no-show host → zero signal for anyone) and brittle to conflicts. v2
crowdsources attendance from everyone present and resolves conflicts *internally*
(never asking users to adjudicate).

Decisions taken: trust-**weighted** resolution (with cold-start handling),
**default-present / flag-exceptions** UX, **resolve once at the 48h window close**.

---

## 1. Model in one line
Everyone present (host + attendees, including self) is prompted when a plan
auto-ends. Each submission defaults everyone to "showed up"; you only flag the
exceptions (no-shows), and you may flag yourself a no-show. At the 48h window
close, a resolver turns all the marks into one verdict per person, weighted by
each marker's trust, and updates scores + familiar faces.

## 2. Schema changes
- **`attendance_marks`** becomes one row *per marker per subject*:
  unique `(plan_id, marked_by, subject_id)` (was `(plan_id, subject_id)`).
  `result ∈ {present, noshow}`. (These are raw *votes*, not the verdict.)
- **Resolved verdict** continues to live on `plan_members.status`
  (`attended` / `noshow`) — written by the resolver at window close, plus
  `resolved_at`. Host's own verdict on the synthetic `is_host_row`.
- Retire **`host_noshow_votes`** + **`vote_host_noshow`** — the host is now just
  another subject, resolved the same way.
- **`attendance_resolutions`** (new, analytics only — **not** used in scoring):
  per resolved plan — `plan_id` (pk), `resolved_at`, `eligible_marker_count`,
  `submission_count`. For future operational visibility into participation rates.

## 3. Marker weight (cold-start-safe)
A marker M's vote weight:

```
weight(M) = base(1.0) × attendanceFactor(M) × verificationFactor(M)
  attendanceFactor: null score (New) → 1.0 (neutral)
                    has score s     → 0.5 + s/100   (50%→1.0, 100%→1.5, 0%→0.5)
  verificationFactor: none → 0.8,  phone → 1.0,  id → 1.2
```

- **Cold start:** at launch nearly everyone is New (null score) + phone-verified →
  weight ≈ 1.0 for all → v2 behaves like a **plain corroborated majority**. As real
  attendance scores accumulate, weights diverge and it becomes truly trust-weighted.
  So weighting "turns on" automatically; no chicken-and-egg.
- **Credibility floor (0.5):** a participant's *no-show flag against others* counts
  toward resolution only if their weight ≥ 0.5. Cold-start (0.8–1.2) → everyone
  counts; a matured chronic no-show (weight < 0.5) is excluded from flagging others.
  With the numeric threshold T removed (§4), this floor is the load-bearing use of
  weighting. **Self-no-show is exempt** (§4 rule 1) — a self-admission of absence is
  always accepted regardless of weight.
- All constants (factors + floor) live in one SQL function — tunable without a schema change.

## 4. Resolver (runs once per plan at `ended_at + 48h`)

**Participant set** = host + accepted attendees (joined/approved). N = |participants|.

**Credible marker** (who may testify): a participant who submitted a form, did not
self-flag no-show, and whose weight ≥ **credibility floor (0.5)**. At cold-start every
New user's weight is 0.8–1.2 ≥ 0.5, so all submitters are credible; as scores mature
a chronic no-show (weight < 0.5) stops counting as a flagger. **This floor is where
trust-weighting stays load-bearing now that the numeric threshold T is removed.**

**Verdict for each subject S** (default present; flip only on clear signal):
1. **S self-flagged no-show → NOSHOW** — authoritative: **bypasses the credibility
   floor and the ≥2-flagger rule.** Even a sub-floor / low-trust user's self-no-show
   is always accepted (honest self-admission of absence). (Such a person is also not
   a credible marker for *others* — they admit they weren't there.)
2. Else if **≥2 distinct credible markers flagged S no-show → NOSHOW**
   (corroborated; a single flag never penalizes — anti-grief). *(No weighted sum / T.)*
3. Else **PRESENT if S was witnessed** — i.e., ≥1 credible marker *other than S*
   submitted (and, under default-present, didn't flag S).
4. Else **UNRESOLVED** — no independent witness; the plan doesn't count toward S's
   score. (Self-present never forces a verdict.)

**Two-person plans (N = 2) — special rule (approved):**
- Resolve **only if both participants submit.** Both submit + neither flags the
  other → **both PRESENT** (mutual confirmation is the minimum valid witness).
- A self-no-show still applies to that person; the other (both submitted) → PRESENT.
- A single cross-flag can't no-show anyone in a dyad (rule 2 needs ≥2 flaggers; only
  one other exists) → only self-no-show works.
- Fewer than both submit → **both UNRESOLVED** (don't reward the non-submitter over
  the submitter; differs from N≥3 vouching — see §9).

**Host-only (N = 1) → UNRESOLVED** (no independent witness).

**Self-no-show participant — fully excluded from the trust exchange (explicit).**
A participant who self-flags no-show, for that plan:
- is **not a credible marker** → their marks of others are ignored in resolution;
- **cannot endorse anyone** → their staged tags are dropped;
- **cannot receive endorsements**;
- **does not contribute to familiar-face generation**;
- i.e., endorsements and familiar faces only ever connect two **resolved-PRESENT**
  people. (Naturally enforced: endorsements/faces are built only from
  `plan_members.status='attended'`, and a self-no-show is resolved `noshow`.)
The self-no-show verdict itself stays authoritative (floor-exempt, §4 rule 1).

### Worked examples
- *N≥3 — host: A no flag, B flags no-show* → 1 credible flagger (<2) → **host PRESENT**.
- *N≥3 — B and C both flag host no-show* → 2 credible flaggers → **host NOSHOW**.
- *Dyad — both submit, no flags* → **both PRESENT**.
- *Dyad — only A submits* → **both UNRESOLVED** (both must submit).
- *Dyad — A flags B no-show, both submit* → only 1 flagger → **B PRESENT** (only a
  self-no-show could make B a no-show in a dyad).
- *Anyone self-flags no-show* → **that person NOSHOW**.
- *N≥3 — S not flagged, didn't submit, but others did* → **PRESENT** (vouched).
- *Subject nobody else submitted about* → **UNRESOLVED** (self-present ≠ verdict).
- *Nobody submits* → everyone UNRESOLVED; no score movement.

## 5. Scoring + endorsements (downstream)
- **`compute_attendance_score`** reads the **resolved** verdicts (count of
  `plan_members` rows where the user is `attended` vs `noshow` across plans), not
  raw votes. `present/(present+noshow)`, null when `<3` resolved → "New". (UI "New"
  already done in Wave 4.)
- **Endorsement guard** keys on resolved `attended` (giver + receiver), not raw
  marks. Endorsement tags stay optional and single-per-pair (unchanged).
- **Familiar faces** rebuilt from resolved-present attendees at window close.
- Score-change notifications fire on resolution (improved/dropped), once.

## 6. UX (preserve the existing Endorse screen shape)
- On auto-end, **every** participant (host + attendees) gets the `plan_ended_*`
  prompt → Endorse.
- Endorse list shows **all participants incl. host and self**, each **pre-set to
  "showed up."** You tap only to flag a no-show (incl. yourself). One tap to submit
  if everyone came. Endorsement tags remain optional below each present person.
- No "host no-show vote" affordance needed — flagging the host is the same as
  flagging anyone (the host appears in the list).
- **Self-no-show hides endorsing.** The moment the submitter flags *themselves* as
  no-show, all endorsement-tag controls are hidden/disabled with a note
  ("Endorsements are only available to attendees") — a no-show can't endorse. They
  can still submit their attendance marks (incl. the self-no-show).
- No visual redesign — same rows/pills/tags; only the default state + "self/host in
  the list" change.

## 7. Timing
- Marks accepted from `ended_at` until `ended_at + 48h`.
- New cron `fn_resolve_attendance()` (~hourly) finds plans whose 48h window just
  closed and not yet resolved → runs the resolver → writes verdicts, scores,
  familiar faces, notifications, **and one `attendance_resolutions` row**
  (`eligible_marker_count` = N participants, `submission_count` = # who submitted).
  (Auto-end cron from 0014q is unchanged.)
- Trade-off accepted: scores finalize ~2 days after the plan.

## 8. Migration impact summary
**Schema:** alter `attendance_marks` unique key → `(plan_id, marked_by, subject_id)`;
**create `attendance_resolutions`** (analytics); keep verdict on `plan_members.status`
+ `resolved_at`; drop `host_noshow_votes`.
**Functions:** new `fn_marker_weight(user)` (factors + 0.5 credibility floor),
`fn_resolve_attendance()` (count-based ≥2-flagger rule, N=1/2 special-cases, writes
verdicts + scores + familiar faces + notifications + metrics row), cron
`hopon-resolve-attendance` (~hourly, guarded); **drop `vote_host_noshow`**; rewrite
`submit_endorsements` (any present participant may submit; default-present; `result`
no longer host-only; accepts marks for self + host); repoint
`compute_attendance_score` to **resolved** `plan_members` verdicts; repoint
endorsement guard to resolved `attended`; **remove host auto-present from `end_plan`**
(host is resolved by peers like every other participant — confirmed).
**Client:** Endorse screen — list **all** participants incl. self + host,
**default-present**, flag exceptions; drop the "report host no-show" link;
`submit_endorsements` payload = per-subject present/noshow + optional tag.
**Tests (pgTAP):** weight + cold-start; credibility floor; ≥2-flagger no-show;
single-flag → present; self-no-show authoritative; N=1 unresolved; N=2 both-submit →
present, one-submit → unresolved, dyad cross-flag → present; score from resolved
verdicts; endorsement-guard on resolved; metrics row counts; idempotent re-resolve;
late (post-48h) submission rejected.
**No backfill:** additive; v1 host marks remain valid high-weight votes in transit.

## 9. Edge cases
- **Host-only (N=1)** → no witness → UNRESOLVED (no score effect).
- **Dyad (N=2), only one submits → both UNRESOLVED.** *New asymmetry introduced by
  the two-person rule:* in N≥3 a non-submitter can be vouched present by others, but
  in a dyad the sole witness is the other person, so we require both to submit. A
  diligent lone submitter therefore gets no credit if their partner ignores it — by
  design, to avoid rewarding the non-submitter over the submitter. (Confirm in §11.)
- **Dyad cross-flag** → a single no-show flag can never resolve no-show (rule 2 needs
  ≥2 flaggers; a dyad has only one possible flagger) → subject stays PRESENT; **only a
  self-no-show can mark someone absent in a dyad.**
- **Dyad, one self-flags no-show, the other doesn't submit** → the self-no-show is
  authoritative (that person NOSHOW), but the other has no submitter vouching → the
  other is UNRESOLVED.
- Late marks after 48h → rejected (window closed).
- Re-resolution idempotent (cron re-run doesn't double-count, re-notify, or
  duplicate the metrics row).
- A user who never opens the app → their own marks absent, but others still resolve
  *them* (N≥3); in a dyad this leaves both unresolved.

## 10. Rollout
Additive migration; resolver cron starts resolving new plans. v1 host-marks still
function during transition (host's marks are just high-weight votes). No backfill
needed.

## 11. Sign-off status — ✅ LOCKED
1. Weight constants + **0.5 credibility floor** — accepted (tunable).
2. **"Remove T" reconciliation** — accepted: no-show = count of ≥2 distinct credible
   flaggers; weighting retained via the credibility floor + future lever.
3. **Host auto-present — DROPPED** (host resolved by peers like everyone). ✅
4. **Dyad one-submit → both UNRESOLVED** — accepted.
5. **Self-no-show bypasses the credibility floor** (and the ≥2-flagger rule) — ✅
   stated explicitly in §3 + §4 rule 1.

> Incorporated: two-person rule (§4), threshold T removed (§4), participation metrics
> (§2/§7), host auto-present dropped (§8), self-no-show floor-exempt (§3/§4). Unchanged:
> self-present never forces, late rejected, idempotent, cold-start weighting, familiar
> faces/endorsements from resolved attendance.
