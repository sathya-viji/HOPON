# Wave 6 Gate — Phase 6 Safety & Moderation (Behavioral Acceptance)

**Date:** 2026-06-15
**Method:** Behavioral, not implementation review. Drove the real PostgREST +
Edge Functions as the seeded users / service role on a clean `supabase db reset`,
read DB state via psql, and recorded the observed outcome for every acceptance
criterion. Reference: `docs/SAFETY_INTERACTION_MATRIX.md` (as-built spec).
Harness: `scripts/gate_wave6_safety.mjs` (re-runnable).

## Verdict: ✅ GATE PASS — **61 / 61** criteria PASS, 0 FAIL.

> Evidence below is the literal observed value from the run. "Decision" items
> (matrix §Resolution: #4, #6, #7) are intended behaviours and are asserted as
> the EXPECTED outcome.

---

### 1. Block-pair invisibility  (A blocks B; C = third party) — 16/16 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| BP1a | Blocker can't see blocked profile (`users_public`) | rows=0 | ✅ |
| BP1b | Blocked can't see blocker (bidirectional) | rows=0 | ✅ |
| BP2a | Blocked user's active plan hidden from blocker (`get_plan_detail`) | plan_not_found | ✅ |
| BP2b | Blocker can't join blocked user's plan | blocked | ✅ |
| BP3 | Blocked user's story hidden from blocker feed | present=false | ✅ |
| BP4a | Blocked user's recap hidden from blocker feed | present=false | ✅ |
| BP4b | Blocked user's recap detail blocked | recap_not_found | ✅ |
| BP5 | Blocked user's comment on a 3rd-party recap hidden (0014j) | visible=false | ✅ |
| BP6 | Blocked user hidden from Familiar Faces (0014j) | rows=0 | ✅ |
| BP7 | Notifications from blocked actor excluded (0014j) | present=false | ✅ |
| BP8 | Contact matching excludes blocked user (0014j) | match=@priya only | ✅ |
| BP9 | Cannot follow a blocked user | blocked | ✅ |
| BP10 | Shared-plan messages from blocked user **stay visible** (decision #4) | devSend=200, seesDevMsg=true | ✅ |
| BP11 | Block severs follow edges both directions | edges=0 | ✅ |
| BP12a | Unblock restores profile visibility | rows=1 | ✅ |
| BP12b | Unblock does **not** restore severed follows (decision) | follows stay severed | ✅ |

### 2. Suspension enforcement — 11/11 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| SU0 | User marked suspended | suspended | ✅ |
| SU1 | Suspended cannot create_plan | account_suspended | ✅ |
| SU2 | Suspended cannot join_plan | account_suspended | ✅ |
| SU3 | Suspended cannot post_recap | blocked | ✅ |
| SU4 | Suspended cannot post_story | account_suspended | ✅ |
| SU5 | Suspended cannot comment | account_suspended | ✅ |
| SU6 | Suspended cannot follow | account_suspended | ✅ |
| SU7 | Suspended cannot send_message | blocked | ✅ |
| SU8 | Suspended profile **stays visible** in users_public (decision #7) | rows=1 | ✅ |
| SU9 | `fn_expire_suspensions` reactivates after `suspended_until` | status=active | ✅ |

### 3. Emergency escalation — 4/4 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| EM1 | Emergency report → status forced `escalated` (trigger) | escalated | ✅ |
| EM2 | Emergency on a **user** does NOT auto-suspend (decision #6) | active | ✅ |
| EM3a | `emergency-escalation` edge fn hides the reported plan | is_hidden=t (paged=skipped local) | ✅ |
| EM3b | `emergency_escalated` audit row written | count=1 | ✅ |

### 4. Account deletion lifecycle — 10/10 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| DL1 | `delete_account` soft-deletes (`deleted_at` + suspended) | suspended, deleted=true | ✅ |
| DL2 | Soft-deleted user hidden from `users_public` | rows=0 | ✅ |
| DL4 | Hard delete anonymises in place (name/handle/banned/gender/dob) | `[deleted] / @del_… / banned / prefer_not / 1900-01-01` | ✅ |
| DL4b | Hard delete nulls `auth.users` phone/email | null/null | ✅ |
| DL5a | Hard delete removes stories | 1→0 | ✅ |
| DL5b | Hard delete removes recaps | 0 | ✅ |
| DL5c | Hard delete removes follows (both ways) | 0 | ✅ |
| DL5d | Hard delete removes familiar_faces | 0 | ✅ |
| DL5e | Hard delete removes push_tokens + contact_hashes | cleared | ✅ |
| DL6 | **Trust graph preserved** (attendance_marks + endorsements kept) | marks=1, endorsements=1 | ✅ |

### 5. Moderation thresholds — 8/8 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| MT1 | User auto-suspended at 3 distinct `safety_concern` | suspended | ✅ |
| MT2 | Recap auto-rejected at 3 distinct reports | rejected | ✅ |
| MT3 | Story auto-rejected at 3 distinct reports | rejected | ✅ |
| MT4 | Comment soft-deleted at 3 distinct reports | is_deleted=t | ✅ |
| MT5 | Message soft-deleted at 3 distinct reports | is_deleted=t | ✅ |
| MT6 | Plan auto-hidden at 5 distinct reports | is_hidden=t | ✅ |
| MT7 | **No** action below threshold (2 recap reports) | approved | ✅ |
| MT8 | Thresholds count **distinct** reporters (same reporter ×3 → no action) | approved | ✅ |

### 6. Audit logging — 8/8 ✅
| ID | Action logged | Count | Result |
|---|---|---|---|
| AU1 | `account_status_changed` (suspend) | 4 | ✅ |
| AU2 | `recap_auto_hidden` | 1 | ✅ |
| AU3 | `story_auto_hidden` | 1 | ✅ |
| AU4 | `comment_auto_hidden` | 1 | ✅ |
| AU5 | `message_auto_hidden` | 1 | ✅ |
| AU6 | `plan_auto_hidden` | 1 | ✅ |
| AU7 | `emergency_escalated` | 1 | ✅ |
| AU8 | `account_hard_deleted` | 1 | ✅ |

### 7. Report workflows — 5/5 ✅
| ID | Criterion | Evidence | Result |
|---|---|---|---|
| RW1 | `submit_report` inserts a report row | 204, rows=1 | ✅ |
| RW2 | Per-content target types accepted (recap/story/comment/message) | all 204 | ✅ |
| RW3 | Reporter rate limit at 10/day | rate_limited | ✅ |
| RW4 | `reports` table not client-readable (admin-only RLS) | permission denied (42501) | ✅ |
| RW6 | Report submission is silent (no notification to reporter/target) | notifs 12→12 | ✅ |

---

## Notes
- **Local-only caveats (don't affect the gate):** Twilio founder-paging is
  skipped locally (`paged=skipped`); the emergency edge fn was invoked directly
  to verify its DB effects (in prod the reports trigger dispatches it). The
  in-DB escalation (status=`escalated`) is deterministic and verified.
- **Backstop:** 434 pgTAP also covers Phase 6 (0011/0012 schema+RPC, 0015
  per-content reporting) on every `db reset`.
- All three matrix "decision" items (#4 shared-chat messages stay, #6
  emergency-on-user is human-review, #7 suspended content/profile stays) are
  confirmed as the intended behaviour — asserted PASS.

**Conclusion:** Phase 6 Safety & Moderation behaviour fully satisfies its
acceptance criteria. Gate **PASS**.
