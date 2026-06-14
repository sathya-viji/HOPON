# HopOn — Safety Interaction Matrix

Exact, as-built behavior of every safety action across all surfaces, derived
from the shipped migrations (not the design intent). Purpose: expose hidden
inconsistencies in the safety model before launch hardening (Phase 7).

**Headline finding:** the report system targets only **`user`** or **`plan`**
(`report_target_t = ('user','plan')`). Reporting a **story, recap, comment, or
message** as a distinct object is **not supported** today — you report the
*author* (as `user`) or the *plan*. See §"Inconsistencies" #1.

Legend: ✅ enforced · ⚠️ partial/gap · — no effect · n/a not applicable.
"Bidirectional" = applies to both blocker→blocked and blocked→blocker.

---

## 1. Block User  (A blocks B)

| Surface | Effect |
|---|---|
| Profiles | ✅ Bidirectional hide in `users_public` (`is_blocked_pair`) |
| Plans | ✅ Bidirectional hide (`plans_select`/`plan_visible_to`); A cannot `join_plan` B's plan. ⚠️ Existing shared memberships NOT removed |
| Stories | ✅ Bidirectional hide (`stories_select`) |
| Recaps | ✅ Bidirectional hide (`recaps_select`, `get_recaps_feed`, `get_recap_detail`) |
| Comments | ⚠️ Hidden only *via* recap visibility. On a **third party's** recap, B's comments remain visible to A (`recap_comments_select` has no block filter) |
| Likes | ⚠️ Same gap — B's like on a third party's recap still counts and shows |
| Messages | ⚠️ If A & B share a plan, chat membership persists → they still see each other's messages |
| Follows | ✅ Severed **both directions** (incl. pending) by `block_user` |
| Familiar Faces | ⚠️ NOT hidden — `familiar_faces_select` has no block filter; A still sees B in their network |
| Feed Events | n/a (write-only log, not client-read in v1) |
| Contact Matching | ⚠️ `match_contact_hashes` runs as service (no `auth.uid()`), so block is not applied — a blocked contact could still surface |
| Notifications | ⚠️ Existing rows (e.g. "B liked your recap") not purged; co-member plan notifications still flow |
| Realtime | ✅ Inherits RLS — blocked content does not broadcast where RLS hides it |

## 2. Unblock User  (A unblocks B)

| Surface | Effect |
|---|---|
| Profiles / Plans / Stories / Recaps | ✅ Visibility restored (block row deleted → `is_blocked_pair` false) |
| Follows | ⚠️ NOT restored — severance is permanent; either party must re-follow |
| Comments / Likes / Messages / Familiar Faces | — (were never block-filtered) |
| Feed Events / Contact Matching / Notifications / Realtime | — |

## 3. Report User  (target_type = `user`)

| Surface | Effect |
|---|---|
| Profiles | ⚠️ None immediately. **Auto-suspend** only at ≥3 *distinct* `safety_concern` reports / 7 days → `account_status='suspended'` (7-day timer) |
| Plans/Stories/Recaps/Comments/Likes/Messages/Follows/Familiar Faces | — (no content change from a user report) |
| Feed Events / Contact Matching / Realtime | — |
| Notifications | — (silent; reporter and target are not notified) |
| Audit | ✅ `account_status_changed` only when the threshold trips |

## 4–7. Report Story / Recap / Comment / Message  ✅ RESOLVED (#1)

| Target | Auto-takedown at ≥3 distinct reporters | Audit |
|---|---|---|
| Recap | `moderation='rejected'` (drops from all feeds; author keeps own view) | `recap_auto_hidden` |
| Story | `moderation='rejected'` (drops from story feed) | `story_auto_hidden` |
| Comment | soft-deleted (`is_deleted=true`, body `[deleted]`) | `comment_auto_hidden` |
| Message | soft-deleted (`is_deleted=true`, body `[deleted]`) | `message_auto_hidden` |

`report_target_t` now includes `recap/story/comment/message` (migration 0002a);
`submit_report` applies the per-content thresholds (0014l). Emergency on any of
these still escalates via the reports trigger. Reporter rate limit (≤10/day) and
admin-only `reports` visibility unchanged.

## 8. Report Plan  (target_type = `plan` — the other valid target)

| Surface | Effect |
|---|---|
| Plans | ✅ **Auto-hide** at ≥5 *distinct* reporters → `plans.is_hidden=true` (removed from discovery/feeds; host still sees it) |
| Recaps/Stories | — (recaps on a hidden plan remain visible — they're public by D12) |
| Audit | ✅ `plan_auto_hidden` |
| Notifications / Realtime | — |

## 9. Emergency Report  (reason = `emergency`, any target)

| Surface | Effect |
|---|---|
| Reports | ✅ Status forced to `escalated` (trigger) |
| Plans | ✅ If `target_type='plan'`: `emergency-escalation` Edge Fn auto-hides it |
| Profiles (user target) | ⚠️ **No automatic restriction** — emergency on a *user* pages the founder but does NOT auto-suspend; relies on human review |
| Audit | ✅ `emergency_escalated` snapshot (report, reporter, notes, page result) |
| Founder paging | ✅ Twilio SMS to `FOUNDER_ALERT_PHONE` (skipped locally; `pending_jobs` retry on failure) |
| Notifications (in-app) / Realtime | — (escalation is out-of-band to the founder, not in-app) |

## 10. Suspension  (account_status = `suspended`)

| Surface | Effect |
|---|---|
| Profiles | ⚠️ Still visible in `users_public` (only `banned` is hidden) — existing identity/history stays public |
| Plans | ✅ Cannot create or join (`create_plan`/`join_plan` active checks) |
| Stories/Recaps/Comments/Likes/Messages/Follows | ✅ Cannot create any (shared `assert_active` BEFORE-INSERT trigger on all 6 content tables) |
| Existing content | ⚠️ Remains visible (suspension stops new actions; it does not retract history) |
| Familiar Faces / Feed Events / Contact Matching | — |
| Notifications | ⚠️ Still *received* (suspension is write-only restriction) |
| Realtime | — (reads unaffected) |
| Lifecycle | ✅ `suspended_until` → `fn_expire_suspensions` auto-reactivates |

## 11. Hard Delete  (F3, +30 days after soft-delete)

| Surface | Effect |
|---|---|
| Profiles | ✅ Anonymised **in place**: name `[deleted]`, random handle, PII cleared, `gender='prefer_not'`, dob `1900-01-01`, `account_status='banned'`; `auth.users` phone/email nulled |
| Plans | ✅ Active hosted plans were cancelled at soft-delete; ended plans retained with the now-anonymised host (FK preserved) |
| Stories | ✅ Hard-deleted (cascades `story_views`) |
| Recaps | ✅ Hard-deleted (cascades likes/comments) |
| Comments | ✅ Authored comments hard-deleted |
| Likes | ✅ Hard-deleted |
| Messages | ✅ Body → `[deleted]`, row kept for chat continuity |
| Follows | ✅ Deleted both directions |
| Familiar Faces | ✅ Rows containing the user deleted |
| Feed Events | ✅ Actor's rows deleted |
| Contact Matching | ✅ `contact_hashes` (owned) deleted; `push_tokens` deleted |
| Notifications | ✅ Rows where user is recipient or actor deleted |
| Trust graph | ✅ **Preserved** — `attendance_marks` + `endorsements` kept with anonymised identity (others' scores stay correct) |
| Audit | ✅ `account_hard_deleted` |

---

## Inconsistencies & decisions required (the point of this exercise)

| # | Severity | Finding | Smallest fix (Phase 7, needs approval) |
|---|---|---|---|
| 1 | **High** | **No per-content reporting.** `report_target_t=('user','plan')` — stories/recaps/comments/messages can't be reported or taken down individually; only the author/plan. | Extend `report_target_t` to add `'recap','story','comment','message'`; add per-object auto-hide thresholds. (Frozen-enum change — approval required.) |
| 2 | Medium | **Block leaks on third-party content.** `recap_comments_select` / `recap_likes_select` don't apply `is_blocked_pair`, so a blocked user's comments/likes on someone else's recap stay visible. | Add `is_blocked_pair` to both policies (fix-forward). |
| 3 | Medium | **Block doesn't hide Familiar Faces.** `familiar_faces_select` has no block filter. | Add `is_blocked_pair` to the policy (fix-forward). |
| 4 | Medium | **Block doesn't affect shared plans/chat.** Co-members keep seeing each other's messages and plan presence. | Decision: leave (don't kick from joined plans) vs. hide messages from blocked authors in `messages_select`. Recommend: hide messages, keep membership. |
| 5 | Low | **Contact matching ignores blocks** (`match_contact_hashes` runs as service, no `auth.uid()`). | Pass the owner id and exclude blocked pairs inside the function. |
| 6 | Low | **Emergency report on a *user* doesn't auto-restrict** — pages founder only. | Decision: acceptable (human-in-loop) or add immediate precautionary suspend on `emergency`+`user`. Recommend: keep human-in-loop, document SLA. |
| 7 | Low | **Suspended users' existing content stays public** and they still receive notifications. | Likely intended (temporary, write-only restriction). Confirm and document. |
| 8 | Low | **Block doesn't purge stale notifications** referencing the blocked user (`actor_id`). | Optional: filter `get_notifications` on `is_blocked_pair`. |

## Resolution status (all 8 closed)

| # | Decision | Status |
|---|---|---|
| 1 | Per-content reporting | ✅ **Implemented** — `report_target_t` extended (0002a) + per-content auto-takedown in `submit_report` (0014l); tested (0015) |
| 2 | Block leak on third-party comments/likes | ✅ **Fixed** (0014j) — RLS + `get_recap_detail` filter |
| 3 | Block doesn't hide Familiar Faces | ✅ **Fixed** (0014j) — RLS block filter |
| 4 | Block + shared chat | ✅ **Decision: keep membership, messages stay visible** (group-chat semantics; block already hides profile/plans/recaps/discovery). No code change. |
| 5 | Contact matching ignores blocks | ✅ **Fixed** (0014j) — `match_contact_hashes` block filter |
| 6 | Emergency report on a user | ✅ **Decision: human-review only** — pages founder + escalates; no auto-restrict. Current behavior, confirmed. |
| 7 | Suspended users' existing content | ✅ **Decision: leave visible** — suspension is a write-only restriction; history stays. Current behavior, confirmed. |
| 8 | Stale notifications from blocked actor | ✅ **Fixed** (0014j) — `get_notifications` block filter |

The safety model is now complete and internally consistent. No open items.
