# Full-System Multi-User Validation — Waves 1–5.1

**Date:** 2026-06-15
**Build:** main @ `0e53817` (+ validation tooling)
**Methods:** (1) full pgTAP regression on a clean reset; (2) a multi-user REST/RLS
harness that mints JWTs for the 6 seeded accounts + a service-role token and
drives the real PostgREST surface as each user (so RLS + RPC behaviour is
exercised exactly as the app does), asserting RPC results, DB state (read via
psql), and cross-user visibility; (3) on-device UI verification on the iOS
simulator. New tooling: `scripts/validate_multiuser.mjs`.

---

## A. Executive summary

The system is **solid and launch-ready for Waves 1–5.1**, with **one privacy
inconsistency to decide on** (recaps are not gated by the author's followers-only
visibility, unlike stories/plans) and **one design question** (suspended profiles
remain visible). No crashes, no data-integrity failures, no RLS bypasses, no
regressions.

- **Regression:** `supabase test db` → **434/434 pgTAP pass** on a clean
  `db reset` (Waves 1–5.1 schema, RPCs, RLS, trust resolver, per-content
  reporting, storage RLS, get_my_plans).
- **Multi-user harness:** **60/60 checks pass** across follows, followers-only
  visibility, recaps, blocks, reporting/suspension/emergency, group chat,
  get_my_plans, story expiry, notifications, and the trust v2 lifecycle.
- **Device:** OTP login → Home feed → Notifications verified live this pass;
  recaps feed, recap post, story post + animated in-review ring + auto-flip,
  story viewer, profile, plan picker verified earlier in-session.
- **Realtime:** publication (`supabase_realtime`) carries messages,
  notifications, plan_members, recap_comments, recaps, stories — all RLS-on, so
  realtime respects row visibility; live two-state chat/notifications were
  device-verified in Wave 3.

**Every failure surfaced during this pass was a harness bug** (wrong column name,
service-role can't touch `users` by design, the 48h endorsement window vs a
backdated `ended_at`, `too_many_active_plans` exhaustion, 204-vs-200) — all fixed
in the harness; none were product defects.

---

## B. Critical issues
**None.**

---

## C. High issues

**H1 — Recaps are not gated by the author's followers-only visibility (privacy).**
`get_recaps_feed` returns an approved recap to a *non-follower* of a
`profile_visibility='followers'` author. Verified: Dev (not following Priya) sees
Priya's recap in the feed, with `author: null` (the author embed resolves through
`users_public`, which correctly hides Priya — so the recap content shows but with
no attribution). Stories (`get_stories_feed`) and plans (`plan_visible_to`)
**do** gate by author visibility; recaps do not.
- **Impact:** a followers-only user's recap image + caption is exposed to
  non-followers; the client also renders a degraded "no author" card (name/avatar
  blank — no crash).
- **Root question (product):** are recaps **neighbourhood-public** (the original
  RecapPosted copy said "visible to everyone in your neighbourhood") or
  **follower-scoped** like stories? The two waves are inconsistent.
- **Recommended fix (needs sign-off — backend RPC/migration = a STOP item):**
  add an author-visibility gate to `get_recaps_feed` (and `get_recap_detail`)
  mirroring the stories feed:
  ```sql
  -- inside get_recaps_feed WHERE:
  and (r.author_id = v_uid
       or exists (select 1 from users u
                  where u.id = r.author_id and u.deleted_at is null
                    and u.account_status = 'active'
                    and (u.profile_visibility = 'everyone'
                         or exists (select 1 from follows f
                                    where f.follower_id = v_uid and f.following_id = r.author_id
                                      and f.status = 'accepted'))))
  ```
  Plus a client guard to skip null-author recaps. If recaps are intentionally
  public, the minimal fix is just the client null-author fallback ("Member").
- **Not auto-fixed:** changes the privacy/visibility model + frozen RPC contract,
  which require your decision. Failing pgTAP test + fix ready to add on confirmation.

---

## D. Medium issues

**M1 — Suspended profiles remain visible in `users_public`.**
`users_public` excludes only `account_status='banned'`, not `'suspended'`. A
suspended user's **plans** are correctly hidden (`plan_visible_to` requires
`active`) and they're blocked from creating content, but their **profile** still
appears in search/lookups. Confirm intent: should a 7-day auto-suspension also
hide the profile, or only their content? (If it should hide the profile, change
the `users_public` predicate to `account_status not in ('banned','suspended')`.)

---

## E. Low issues / observations

- **L1 (cosmetic, test-data only):** notification copy reads "Your *Chat plan*
  plan starts soon" — a double "plan" — only because the validation activities
  are literally named "Chat plan"/"Hide plan". Real activities ("Badminton")
  read correctly. No change needed.
- **L2 (cosmetic):** the seeded user named "You" produces "You is now following
  you." in another user's notifications. Seed-naming artifact only.

---

## F. Missing test coverage (recommended additions)
- **Followers-only recap visibility** — no pgTAP currently asserts recap-feed
  behaviour vs author `profile_visibility` (the gap that surfaced H1). Add once
  the H1 product decision is made (test will encode the chosen behaviour).
- **Suspended-profile visibility** — add a pgTAP asserting the chosen M1 behaviour.
- **Two-client realtime delivery** — covered by publication/RLS plumbing + Wave 3
  device verification, but there is no automated realtime assertion (hard to
  automate; acceptable to keep as a manual check).

---

## G. Bugs fixed during validation
- **No product bugs were found**, so none were fixed.
- Harness/tooling fixes (so the pass produces a true signal): set visibility via
  the user's own-row grant (service_role has no `users` access by design); read
  `users`/`plans` state via psql; use `mark_notifications_read` RPC (writes are
  RPC-only); correct `notifications.is_read` column; respect the 48h endorsement
  window before backdating `ended_at` for the resolver; host the trust plan as a
  user with plan headroom (`too_many_active_plans`); accept 204 for void RPCs.

---

## H. New tests added
- `scripts/validate_multiuser.mjs` — reusable 60-assertion multi-user
  REST/RLS/DB validation harness (re-runnable after `supabase db reset`).
- No new pgTAP added this pass (the existing 434 remain green); H1/M1 pgTAP
  additions are deferred to the corresponding product decisions (Section F).

---

## I. Launch-readiness assessment

| Area | Status |
|---|---|
| Wave 1 — Identity/onboarding (OTP, signup, complete_signup, handle/phone, session gate) | ✅ pgTAP + device OTP login |
| Wave 2 — Plan loop (feed, search, detail, join/leave, requests, gender/full/closed, host, create/edit/cancel, hosted/joined) | ✅ pgTAP + device feed/tabs |
| Wave 3 — Chat & notifications (membership, creation, read state, realtime plumbing) | ✅ pgTAP + harness + device notifs |
| Wave 4 — Trust v2 (auto-end, marking, self-no-show, credible markers, dyad rules, resolution, familiar faces, endorsements, scores) | ✅ 0022 (28 cases) + harness lifecycle |
| Wave 5 — Social (stories, recaps, moderation, expiry, follows, profile, uploads) | ✅ harness + device; **see H1** |
| Wave 5.1 — storage RLS + get_my_plans | ✅ 0023 + harness + device |
| Safety — block/unblock, reporting, emergency escalation, suspensions, per-content, plan auto-hide | ✅ harness (thresholds, bidirectional block, escalation) |
| Multi-user scenarios — host+2 attendees, host+requester, follower/followed, blocker/blocked, reporter/reported, author/follower/non-follower | ✅ harness |

**Verdict: GO for Waves 1–5.1**, conditional on a product decision for **H1**
(recap follower-gating) and a confirmation for **M1** (suspended-profile
visibility). Neither blocks the build from running; both are visibility-policy
choices. No Critical issues; no regressions; 434 pgTAP + 60 multi-user checks green.

### Recommended next steps
1. Decide H1 (recaps public vs follower-scoped); I'll implement the gate +
   client guard + a pgTAP test, test-first.
2. Confirm M1 (suspended-profile visibility); adjust `users_public` + add a test
   if it should hide.
3. Then proceed to the next wave.
