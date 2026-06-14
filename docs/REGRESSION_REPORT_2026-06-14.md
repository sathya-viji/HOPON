# HopOn — Post-Onboarding Regression Report (2026-06-14)

Scope: everything implemented after onboarding — Wave 2 core plan loop + the
flagged-issue fixes (people search, Google Places geocoding, PlanPosted copy) +
the supporting backend RPCs they use.

Test account: Arjun R (phone 9999999992 / OTP 123452), a **man**, hosts 3 plans.
Dataset: `supabase/seed_dev_testdata.sql` — 36 users, 34 plans (spread over 14
days), 1 full, 8 closed, 3 pending requests on Arjun's closed "Dinner meetup".

Legend: ✅ pass · ⚠️ minor issue · ❌ bug · ⏭️ blocked/skipped

---

## Verdict

The post-onboarding surface (Wave 2 plan loop + the people-search / geocoding /
PlanPosted fixes) is **solid and ship-ready**. The one HIGH issue found during testing
(**BUG #1** — host couldn't read attendees / pending requests) has since been **fixed and
device-verified** (new `get_plan_members` RPC + client repoint; see Bugs fixed). The
optional network-error-copy improvement was also implemented. Everything tested —
discovery, detail, join/leave, closed/full/gender gating, create/edit/cancel, search
(plans + people), geocoding, HomeMap, host attendees + pending + approve/decline,
empty/loading states, refetch, duplicate-tap guards, and network-failure handling —
passes. BUG #2 turned out to match the prototype (no change).

**Update (post-regression fixes):** BUG #1 fixed (backend + client), network-error copy
distinguished. tsc clean; **379 pgTAP assertions pass** (added 11 for `get_plan_members`).

---

## Test dataset (deliverable: test-data report)

Script: `supabase/seed_dev_testdata.sql` — **re-runnable** (`ON CONFLICT DO NOTHING`),
dev-only, applied on top of the base `seed.sql`. Result in DB: **36 users, 34 plans**.

- **30 test users** (`…-a200-…01..30`) — names, `@handle_N`, neighbourhoods cycled over
  6 Bangalore areas, genders cycled man/woman/nonbinary, alternating phone/none
  verification, varied hosted/attended/met/attendance-score stats. Plus the 5 base users
  (Arjun/Priya/Kiran/Sneha/Dev).
- **7 edge-case plans** (`…-b200-…`) hand-built to exercise specific branches:
  Arjun-hosted **open** (host view/edit/cancel), Arjun-hosted **closed w/ 3 requested + 1
  joined** (approve/decline + BUG #1 repro), **women-only** (gender_mismatch for Arjun),
  **men-only** (Arjun can join), **full** (cap 2 + 1 joined), non-Arjun **closed** (Arjun
  can request), **near-term open** (NOW section).
- **23 bulk plans** (`…-b300-…`) hosted by test users, categories/activities/locations
  cycled, mix of open/closed (every 4th) and all/women/men gender prefs, costs cycled.
- **Timing spread**: `now()+90min … now()+~13 days` so the feed stays populated across
  many sessions without a reset. Confirmed 23 future-active plans (21 >1 day) after this pass.
- **Memberships**: Arjun pre-joined to 2 bulk plans (Joined tab + leave target); edge-plan
  memberships drive full/closed/pending states via `trg_sync_spots`.
- All enum columns explicitly cast (`::gender_t`, `::plan_type_t`, `::plan_status_t`,
  `::cost_t`, `::gender_pref_t`, `::verification_level`) — array/CASE exprs are `text`.

Additional automated coverage added (people search): `supabase/tests/0019_search_users_test.sql`
— 12 pgTAP assertions; **368 total pgTAP assertions pass**.

---

## Test matrix & results

(filled in as testing proceeds)

| # | Area | Case | Result | Notes |
|---|------|------|--------|-------|
| 1 | Home feed | Renders, NOW/LATER/THIS WEEK grouping, counts, badges | ✅ | 30 plans; YOURS/HOP ON/Women only/CLOSED/FULL badges; ₹cost; live countdowns |
| 2 | Home feed | Tabs Nearby / Joined·2 / Created·3 | ✅ | counts match DB; Created groups host's plans |
| 3 | Home feed | Wheel-scroll vs drag | ⚠️ | wheel-scroll no-op in sim; drag works (sim input quirk, not app) |
| 4 | Plan detail | Open plan (Quick coffee) | ✅ | host card, joiners count, spots, description, HOP ON |
| 5 | Join | Open plan → PlanJoined → feed reflects | ✅ | "You're in!"; spots/joined updated on return |
| 6 | Leave | Joined → LeaveConfirm → popToTop → feed reflects | ✅ | correct activity copy; flips back to HOP ON |
| 7 | Gender | Women-only plan, join as man | ✅ | join blocked, no nav; toast verified earlier this session |
| 8 | Full plan | Detail footer | ✅ | "2 joined · Full" + disabled "Plan is full"; card shows FULL badge |
| 9 | Closed plan | Detail shows "Request to join" | ✅ | "Closed plan" badge; differs from feed card (see bug #2) |
| 10 | Request | Closed → request → PlanRequested | ✅ | "Request sent"; TrustGrid via getMyProfile (12/28/98%/34) |
| 11 | Withdraw | PlanRequested → withdraw confirm → leave | ✅ | inline confirm; returns to feed |
| 12 | Host view | Own closed plan → "View as host" | ✅ | get_plan_detail viewer_is_host path |
| 13 | Host view | PlanHost attendees + pending | ✅ | was BUG #1 (ATTENDEES·0); **fixed** via `get_plan_members` RPC — now shows ATTENDEES + "3 pending requests" banner |
| 14 | Edit plan | update_plan (rules), no capacity stepper | ✅ | hydrated form; rules null→"Byob" persisted in DB |
| 15 | Cancel plan | cancel_plan → confirm → popToTop | ✅ | correct copy; Created tab → empty state after |
| 16 | Empty state | Created tab (no plans) | ✅ | "You haven't posted a plan yet" + Post a plan |
| 17 | Approve/Decline | PlanRequests list | ✅ | unblocked by BUG #1 fix — 3 requesters listed; **approved Ravi Menon → moved to ATTENDEES, pending 3→2** on refetch |
| 18 | Search · people | "Priya"/"Meera" → PEOPLE section | ✅ | server-side `search_users`, debounced, inline verified badge, taps to profile route |
| 19 | Search · plans | typed query filters feed | ✅ | "Coffee" matches; "Sax" → "No plans found" empty state |
| 20 | Geocoding | LocSearch autocomplete + pick | ✅ | live Google Places; Indiranagar persisted 12.97837,77.64084 |
| 21 | HomeMap | faux-map pins by lat/lng, pin card | ✅ | pin select card + HOP ON; geo off real feed |
| 22 | Network · read | open plan w/ gateway down | ✅ | graceful "This plan isn't available" + Try again; no crash |
| 23 | Network · retry | Try again offline → still err; restore → loads | ✅ | recovered fully (Cricket nets detail) on retry after gateway back |
| 24 | Network · mutation | HOP ON w/ gateway down | ✅ | toast "Couldn't join this plan."; no nav, no false optimistic state |
| 25 | Dup-tap | join/leave/cancel/create/approve guards | ✅ | code: `joining`/`busy`/`submitting`/`busyId` guards + disabled buttons |
| 26 | Create · validation | past/too-far start time | ✅* | *server-enforced (pgTAP `starts_in_past`/`starts_too_far`); client toast path verified via gender_mismatch. On-device repro unreliable — sim clock skewed ~5.5h ahead of server (env quirk, not app) |
| 27 | Empty states | Created tab (none), search no-match | ✅ | "You haven't posted a plan yet" + Post a plan; "No plans found" |
| 28 | Network · copy | plan-detail error wording (post-fix) | ✅ | gateway-down now shows 📡 "Couldn't load this plan / Check your connection"; not-found keeps "isn't available" (errorCode-keyed) |
| — | Time drift | near-term plans age out of feed | ✅ | spread dataset held: 23 future-active plans (21 >1 day) after this pass |

---

## Bugs found

### BUG #1 — HIGH — ✅ FIXED — Host cannot see attendees or pending requests (member read fails)
**Where:** `PlanHostScreen` / `PlanRequestsScreen` via `getPlanMembers` (`src/api/plans.ts:218`).
**Symptom:** Host's own plan shows "ATTENDEES · 0" and no pending-requests banner even
when members exist (verified: "Dinner meetup" has 1 joined + 3 requested in DB;
`get_plan_detail` correctly reports "2/6 joined", but the member list is empty).
**Root cause (backend):** `getPlanMembers` does a direct `from('plan_members').select()`.
As the `authenticated` role this triggers the `plan_members` SELECT RLS, whose host
branch `EXISTS(SELECT 1 FROM plans WHERE id=... AND host_id=auth.uid())` evaluates the
`plans_select` policy, which reads `users.deleted_at` and `users.account_status`.
`authenticated` is **not** granted SELECT on those two columns (intentional — they hide
suspension state), and Postgres checks column privileges at plan time (OR short-circuit
doesn't save it), so the query throws **`permission denied for table users`**. The
`catch` in `usePlanMembers` swallows it → empty list.
Verified as `authenticated` in a txn: `users_public` reads OK, `plan_members` read → error.
**Impact:** Breaks PlanHost attendees + pending banner, the PlanRequests list, and so the
**approve/decline flow has no way to surface requests**. (The approve/decline/cancel/leave
RPCs themselves work — pgTAP-covered — only the host-side *read* is broken.)
**Scope:** Only `plan_members` is affected; all other client reads are own-row `users_public`.
**Recommended fix (needs backend — flagged, not implemented per standing orders):**
add a `SECURITY DEFINER` RPC, e.g. `get_plan_members(p_plan_id)` /
`get_plan_requests(p_plan_id)`, returning member rows + public profile for the host
(mirrors `get_plan_detail`'s definer pattern, bypassing the RLS cascade), then point
`getPlanMembers` at it. Do **not** grant `authenticated` the hidden `users` columns.
Alternative: refactor `plans_select` to use a `SECURITY DEFINER` helper (like
`plan_visible_to`) instead of inline `users` access — broader RLS change.

### BUG #2 — NOT A BUG (matches prototype by design) — Closed-plan feed card shows "HOP ON"
**Original concern:** A closed plan's feed-card button reads "HOP ON" while the detail
screen shows "Request to join".
**Verdict after checking the prototype:** This is **intended**. In `hopon-v4.html`,
`PlanRow` (the feed card, lines 1073–1098) renders the CTA as YOURS / FULL / ✓ IN /
**HOP ON** only — it never substitutes "Request" for closed plans; the closed state is
conveyed solely by the "🔒 CLOSED" meta tag (line 1098). The "Request to join" label
appears **only on the detail screen** (line 2225: `plan.type === 'closed' ? 'Request to
join' : 'HOP ON'`). Our app reproduces both behaviours exactly. Per the visual-fidelity
rule, **no change made** — altering `PlanRow` would diverge from the prototype.
**Status:** Closed (working as designed). The "HOP ON" tap opens detail, where the user
correctly sees "Request to join".


## Bugs fixed

### BUG #1 — host member read (HIGH) — FIXED
- **Backend:** new additive migration `20260614000001_0014p_get_plan_members.sql` —
  `get_plan_members(p_plan_id)` `SECURITY DEFINER`, host-only (raises `not_authorized`
  for non-hosts, `plan_not_found` / `not_authenticated` otherwise), returns a jsonb array
  of non-host members (`is_host_row` excluded) LEFT JOINed to `users_public`. Runs as
  owner so it bypasses the `plan_members → plans_select → users` column-privilege cascade
  that was throwing "permission denied for table users". Hidden `users` columns are **not**
  granted to `authenticated` (suspension stays hidden).
- **Tests:** `supabase/tests/0020_get_plan_members_test.sql` — 11 pgTAP assertions
  (contract/grants, host sees joined+requested, host row excluded, profile name joined,
  non-host rejected, unknown plan, unauthenticated). Full suite **379 assertions pass**.
- **Client:** `getPlanMembers` (`src/api/plans.ts`) now calls the RPC and maps the combined
  rows; the direct `plan_members`/`users_public` selects are gone. `PlanMemberSummary`
  shape unchanged, so `usePlanMembers` / PlanHost / PlanRequests needed no change. tsc clean.
- **Device-verified end-to-end:** PlanHost now shows "ATTENDEES · 1" (Meera Iyer) + a
  "3 pending requests" banner; PlanRequests lists all 3 (Ravi/Anita/Vikram); **approving
  Ravi moved him to ATTENDEES (→2) and dropped pending to 2** on refetch.
- **Re-verified post-checkpoint (2026-06-14, fresh `db reset`):** attendees visible,
  pending visible, **approve** (Ravi→attendees) AND **decline** (Anita removed) both work;
  requester state propagates in UI (ATTENDEES·2, 1 pending) and DB (Meera=joined,
  Ravi=approved, Anita=declined, Vikram=requested). Gate for Wave 3 — PASS.

### Network-error copy (optional, Low) — FIXED
- `PlanScreen` error state now keys on `errorCode`: a genuine `plan_not_found`/`blocked`
  keeps "This plan isn't available"; anything else (network/unknown) shows 📡 "Couldn't
  load this plan / Check your connection and try again." Device-verified with the gateway
  stopped. Client-only, tsc clean.

### Re-verified (no change needed)
- BUG #2 reclassified as intended behaviour (matches prototype `PlanRow`) — no edit.
- The three Wave-2 follow-ups (people search, Google Places geocoding, PlanPosted copy,
  covered in `WAVE2_REPORT.md` §6b) re-verified on-device this pass, all ✅.


## Remaining issues by severity

**Critical:** none.

**High:** none open. *(BUG #1 — host member read — found this pass and now FIXED + verified.)*

**Medium:** none open.

**Low:**
- **GO_BACK dev warning** seen once during very rapid back-taps on a header; not
  reproducible in normal use; dev-only. No user impact.
- *(Network-error copy — found this pass and now FIXED.)*

**Environment caveats (not app defects):**
- iOS-sim hardware-keyboard `type` drops characters → use per-key `key`/batched input.
- Sim wheel-scroll is a no-op in lists → use drag.
- Sim system clock drifted ~5.5h ahead of the (real-time) server clock, making on-device
  past-time create validation unreliable to reproduce; `starts_in_past`/`starts_too_far`
  remain pgTAP-covered with the client toast path verified.


## Recommended next actions

1. ~~Fix BUG #1 (HIGH, backend).~~ **DONE** — `get_plan_members` RPC + client repoint +
   11 pgTAP, device-verified end-to-end.
2. ~~Distinguish network vs not-found in `PlanScreen`.~~ **DONE** — errorCode-keyed copy.
3. **Deferred hardening (non-blocking, tracked):** restrict + rotate the Google Places key
   (founder action) and move Places calls behind a `places-proxy` Edge Function.
4. **Proceed to Wave 3 (notifications).** The post-onboarding surface is solid and the
   host side of the loop now works end-to-end. Re-apply the one-screen-at-a-time review
   rule for Wave 3. Before deploying, run `supabase db reset` once to confirm the two new
   migrations (0014o search_users, 0014p get_plan_members) apply cleanly from scratch in
   order (they applied live this session; a from-zero reset is the final check).
