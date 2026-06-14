# HopOn — Notification Event Matrix

Every `notif_type` (41 total), what triggers it, and its delivery class. Source
of truth for `notif_push_allowed()` and the Edge Function `push-sender`.

## Delivery classes

| Class | In-app row | Realtime | Push | Prefs respected |
|---|---|---|---|---|
| **Mandatory** | ✓ | ✓ | always | no — `push_enabled` ignored |
| **Preference-controlled** | ✓ | ✓ | if `push_enabled` (default on) | yes |
| **Silent** | ✓ | ✓ | never | n/a (never pushes) |

- **In-app + realtime** delivery is identical for all classes: every notification
  is a `notifications` row, broadcast on `user:{id}:notifications`. The class
  only governs **push**.
- `notif_push_allowed(user, type)` encodes the class: `false` for silent,
  `true` for mandatory, else the user's `push_enabled` pref (default `true`).
- Chat messages are **not** notification rows — they push directly via
  `chat-push` and never appear here, except the `mention` row they spawn.

## Matrix

| # | notif_type | Trigger | Class | Phase wired |
|---|---|---|---|---|
| 1 | `plan_posted` | `create_plan` | **Silent** | 2 |
| 2 | `new_joiner` | `join_plan` (open) | Preference | 2 |
| 3 | `join_request` | `join_plan` (closed) | Preference | 2 |
| 4 | `joiner_left` | `leave_plan` | Preference | 2 |
| 5 | `plan_full` | `join_plan`/`approve_request` fills last spot | Preference | 2 |
| 6 | `plan_starting_soon_host` | cron `fn_notify_starting_60` | Preference | 3 |
| 7 | `plan_started_host` | cron `fn_notify_started_5` | Preference | 3 |
| 8 | `plan_ended_host` | `end_plan` | Preference | 4 |
| 9 | `endorse_reminder` | cron (endorse window) | Preference | 4* |
| 10 | `recap_reminder` | cron (recap window) | Preference | 5* |
| 11 | `plan_cancelled_confirm` | `cancel_plan` (to host) | **Silent** | 2 |
| 12 | `host_marked_absent` | `vote_host_noshow` quorum | **Mandatory** | 4 |
| 13 | `new_recap_on_your_plan` | `post_recap` | Preference | 5 |
| 14 | `request_approved` | `approve_request` | **Mandatory** | 2 |
| 15 | `request_declined` | `decline_request` | **Mandatory** | 2 |
| 16 | `plan_updated` | `update_plan` (material change) | Preference | 2 |
| 17 | `plan_cancelled` | `cancel_plan` (to members) | **Mandatory** | 2 |
| 18 | `plan_starting_soon_joiner` | cron `fn_notify_starting_60` | Preference | 3 |
| 19 | `plan_starting_15` | cron `fn_notify_starting_15` | Preference | 3 |
| 20 | `plan_ended_joiner` | `end_plan` | Preference | 4 |
| 21 | `marked_noshow` | `submit_endorsements` (host marks no-show) | **Mandatory** | 4 |
| 22 | `mention` | `prepare_chat_push` (@handle in message) | Preference | 3 |
| 23 | `endorsement_received` | `submit_endorsements` (batched per plan) | Preference | 4 |
| 24 | `attendance_score_improved` | `compute_attendance_score` (score up) | **Silent** | 4 |
| 25 | `attendance_score_dropped` | `compute_attendance_score` (score down) | Preference | 4 |
| 26 | `new_familiar_face` | `rebuild_familiar_faces` (new pair) | Preference | 4 |
| 27 | `recap_liked` | like-batch cron | Preference | 5* |
| 28 | `recap_commented` | `comment_recap` | Preference | 5 |
| 29 | `recap_comment_replied` | `comment_recap` (prior commenters) | Preference | 5 |
| 30 | `new_recap_from_following` | `post_recap` (follower fan-out) | Preference | 5 |
| 31 | `story_expiring_soon` | cron (story TTL −2h) | Preference | 5* |
| 32 | `new_follower` | `follow_user` (accepted-direct) | Preference | 5 |
| 33 | `follow_request` | `follow_user` (pending) | Preference | 5 |
| 34 | `follow_accepted` | `accept_follow` | Preference | 5 |
| 35 | `following_posted_plan` | `create_plan` fan-out (`fanout_following_posted_plan`) | Preference | 5 |
| 36 | `welcome` | `complete_signup` | **Mandatory** | 1 |
| 37 | `profile_incomplete` | cron onboarding nudge | Preference | 7* |
| 38 | `first_plan_nudge` | cron onboarding nudge | Preference | 7* |
| 39 | `contact_joined` | `complete_signup` (inverse contact match) | Preference | 1 |
| 40 | `plan_expired_host` | cron `fn_expire_plans` | Preference | 3 |
| 41 | `plan_expired_joiner` | cron `fn_expire_plans` | Preference | 3 |

`*` = trigger lands in a later phase; the type + class are defined now.

## Class summaries

**Mandatory (6)** — frozen non-configurable set, always push:
`request_approved`, `request_declined`, `plan_cancelled`, `host_marked_absent`,
`marked_noshow`, `welcome`. These are action results or trust/safety signals the
user cannot miss.

**Silent (3)** — in-app only, never push:
`plan_posted` (host's own confirmation), `plan_cancelled_confirm` (host's own
confirmation), `attendance_score_improved` (positive, non-urgent).

**Preference-controlled (32)** — push gated by `notification_prefs.push_enabled`
(default on); the user can disable each from the Notifications settings screen.

## Settings screen note

`attendance_score_dropped`, though preference-controlled here per the frozen 6-type
mandatory set, is a trust signal — the client should present it as a high-signal
toggle. The three Silent types should **not** appear as push toggles in settings
(they never push); they may still appear as in-app feed items.
