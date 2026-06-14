# HopOn — Social Graph Interaction Matrix (Phase 5 readiness)

Validation of every interaction across Stories, Recaps, Follows, Likes,
Comments, Feed Events, Notifications, Realtime, Push, and Privacy **before**
Phase 5 implementation. No code. Cross-checked against the frozen schema
(migrations 0009 social.sql, 0011 notifications, feed_events stub),
`NOTIFICATION_MATRIX.md` (41 types), and decisions D2/D10/D12/D13/S1.

> **One blocking inconsistency found** — recap image cardinality (§7 / readiness
> review). Everything else is consistent and implementation-ready.

---

## Frozen building blocks (recap)

| Object | Table | Key facts |
|---|---|---|
| Recap | `recaps` | `image_path text` (**single image**), `caption`, `like_count`, `comment_count`, `moderation`, `plan_id`, `author_id` |
| Like | `recap_likes` | PK `(recap_id,user_id)` |
| Comment | `recap_comments` | `body`, `is_deleted` soft-delete |
| Story | `stories` | `image_path` single, `expires_at = created_at+24h` (D2), `moderation` |
| Story view | `story_views` | PK `(story_id,viewer_id)` |
| Follow | `follows` | `status` pending/accepted (S1) |
| Activity log | `feed_events` | `actor_id, event_type, object_id` — **stub, no fan-out at v1** (D13) |
| Like batch | `recap_like_batches` | `unsent_count`, `last_sent_at` — batched-push state |

Privacy inputs: `users.profile_visibility` (everyone/followers/nobody),
`plan_visibility` (everyone/followers), `blocks` (full enforcement Phase 6).

---

## 1. Stories

| Action | Feed event? | Notification? | Realtime? | Push? | Audit? | Privacy rule |
|---|---|---|---|---|---|---|
| **Create story** | No (ephemeral — discovered via the story-bubble row, not activity-feed material) | **None** — there is no `new_story_*` type; surfacing is UI-only | No dedicated channel | No | No (moderation result → `image_rejected` audit only on reject) | Visible per author `profile_visibility`: everyone→all; followers→accepted followers + self; nobody→self only. Excludes blocked pairs. `moderation='approved'` required. |
| **View story** | No | None | No | No | No | Viewer must satisfy the story's visibility; insert `story_views(story_id,viewer_id)`. Author may read the viewer list. |
| **Delete story** | No | None | No | No | No | Author only. Hard delete + storage object removal. |
| **Story expiry** | No | `story_expiring_soon` to **author**, 2h before `expires_at` (cron) | Yes — via `user:{author}:notifications` | Yes (preference-controlled) | No | The expiring author only; expiry itself (deletion) is silent. |

Rules enforced in RPC, not schema: **max 3 active stories** per author
(`count(stories where expires_at>now()) < 3` in `post_story`); 24h expiry is the
column default. `story_expiring_soon` is the only story notification.

---

## 2. Recaps

| Action | Feed event? | Notification? | Realtime? | Push? | Audit? | Privacy rule |
|---|---|---|---|---|---|---|
| **Create recap** | **Yes** — `feed_event(recap_created)` (write-only; read by future activity feed) | `new_recap_on_your_plan` → plan host; `new_recap_from_following` → author's accepted followers | Recipients' `user:{id}:notifications` | Both preference-controlled | On moderation reject → `image_rejected` | Author must be a plan participant (member/host) and `created_at >= plan.starts_at`. Recap itself is **public** (D12). |
| **Like recap** | No (too granular) | `recap_liked` → recap author (**batched** via `recap_like_batches`, hourly cron) | Author's channel when batch flushes | Preference-controlled (batched) | No | Liker must be able to see the recap (public minus blocks). Self-like allowed but never notifies self. |
| **Unlike recap** | No | None | No | No | No | Liker removes own `recap_likes` row; decrement `recap_like_batches.unsent_count` if still pending. |
| **Comment recap** | No | `recap_commented` → recap author; `recap_comment_replied` → prior distinct commenters (excl. author + actor) | Recipients' channels | Both preference-controlled | No | Commenter must see the recap. |
| **Delete comment** | No | None | No | No | No | Own comment only → soft-delete (`is_deleted=true`, body `[deleted]`). |
| **Delete recap** | No | None | No | No | Optional `recap_deleted` (not required v1) | Author only. Hard delete; `recap_likes`/`recap_comments` cascade; the `recap_created` feed_event is also removed. |

Counters (`like_count`, `comment_count`) maintained by existing triggers
(migration 0009). `notifications.recap_id` FK to `recaps` is added in Phase 5.

---

## 3. Follow Graph

| Action | Feed event? | Notification? | Realtime? | Push? |
|---|---|---|---|---|
| **Follow → public profile** | No (privacy-sensitive; not in activity feed v1) | `new_follower` → followee | followee channel | Preference-controlled |
| **Follow → followers/nobody profile** | No | `follow_request` → followee (status `pending`) | followee channel | Preference-controlled |
| **Follow accepted** | No | `follow_accepted` → **follower** (the original requester) | follower channel | Preference-controlled |
| **Follow declined** | No | **None** — intentional silent decline (privacy norm; requester not informed). No `follow_declined` type exists or is needed. | — | — |
| **Unfollow** | No | None | No | No |

`nobody` profiles are unfollowable (request rejected at RPC). Accept fires
`follow_accepted` to the follower only (followee initiated, so not notified).
Direct public follow fires `new_follower` to the followee only.

---

## 4. Feed Events decision

`feed_events` is the actor-centric log for a **future** activity feed (D13).
Phase 5 **writes** a minimal set and **reads none** (the recap/story feeds are
built by direct queries against `recaps`/`follows`, not `feed_events`). No
per-follower fan-out rows — visibility is resolved lazily at read time.

| Social action | Create `feed_event`? | event_type | actor | object (`object_id`) | Visibility (computed at read) |
|---|---|---|---|---|---|
| Create recap | **Yes** | `recap_created` | author | recap_id | author `profile_visibility` (recaps public, but feed entry follows profile) |
| Create plan | **Yes** (in the Phase-5 follower fan-out path) | `plan_created` | host | plan_id | host `plan_visibility` |
| Create story | No (ephemeral) | — | — | — | — |
| Like / unlike | No | — | — | — | — |
| Comment / delete | No | — | — | — | — |
| Follow / accept / unfollow | No (v1) | — | — | — | — |
| Story view | No | — | — | — | — |

Rationale: only durable, broadcastable "X did Y" actions are logged. Ephemeral
(stories), high-volume (likes/views), and privacy-sensitive (follows) actions
are excluded to keep the log small and the future activity feed meaningful.

---

## 5. Notification Matrix validation (cross-check vs NOTIFICATION_MATRIX.md)

Every social action maps to an **existing** type. **Zero new types required.**

| Social action | Notification type | Class | Matrix consistent? |
|---|---|---|---|
| Create recap (to host) | `new_recap_on_your_plan` | Preference | ✓ (row 13) |
| Create recap (to followers) | `new_recap_from_following` | Preference | ✓ (row 30) |
| Like recap | `recap_liked` | Preference (batched) | ✓ (row 27) |
| Comment recap | `recap_commented` | Preference | ✓ (row 28) |
| Comment reply | `recap_comment_replied` | Preference | ✓ (row 29) |
| Story expiring | `story_expiring_soon` | Preference | ✓ (row 31) |
| Follow (public) | `new_follower` | Preference | ✓ (row 32) |
| Follow (pending) | `follow_request` | Preference | ✓ (row 33) |
| Follow accepted | `follow_accepted` | Preference | ✓ (row 34) |
| Create plan (to followers) | `following_posted_plan` | Preference | ✓ (row 35) |
| Recap reminder (cron) | `recap_reminder` | Preference | ✓ (row 10) |

**Deliberately silent (no type, validated — not a gap):**
- Create story → no notification (UI bubble discovery).
- View story, like-removal, comment-delete, recap-delete, unfollow → no notification.
- Follow **declined** → silent by design (privacy). No `follow_declined` needed.

No social notification is Mandatory or Silent-class; all are
Preference-controlled. Consistent with the matrix.

---

## 6. Realtime Matrix

No new realtime channels in Phase 5. Social updates ride the **existing**
`user:{id}:notifications` channel (the notification row is the realtime event);
content threads (comments/likes) use client refetch-on-open, not live channels.

| Action | Broadcast channel | Recipient scope | Presence requirement | Fallback (offline) |
|---|---|---|---|---|
| Recap notif (host/followers) | `user:{id}:notifications` | each recipient | none — row persists | push (preference) via push-sender |
| Like (batched) | `user:{author}:notifications` | recap author | none | push when batch flushes |
| Comment / reply | `user:{id}:notifications` | author + prior commenters | none | push (preference) |
| Follow / request / accept | `user:{id}:notifications` | the one recipient | none | push (preference) |
| `following_posted_plan` | `user:{follower}:notifications` | each accepted follower | none | push (preference) |
| `story_expiring_soon` | `user:{author}:notifications` | story author | none | push (preference) |
| Live comment thread | **none** | — | viewer on recap screen | client refetch (no realtime) |
| Story view counter | **none** | — | author on own story | client refetch |

Presence is never required — every user-facing social event is a persisted
notification row first; realtime is an accelerant, push is the offline fallback,
and the in-app feed (`get_notifications`) is the durable backstop.

---

## 7. Media Decisions

| Constraint | Stories | Recaps |
|---|---|---|
| Image only (no video) | ✅ confirmed | ✅ confirmed |
| Max per unit | ✅ 3 active stories (RPC-enforced) | ⚠️ **5 images — CONFLICTS WITH SCHEMA** (see below) |
| Expiry | ✅ 24h (D2) | n/a (permanent) |
| Max size | ✅ 5 MB | ✅ 5 MB per image |
| Video | ❌ none, no exceptions | ❌ none, no exceptions |

Storage buckets (`config.toml`): `stories` 5 MB / image MIME; `recaps` currently
10 MB → **should tighten to 5 MB** to match this decision. All uploads pass
Google Vision SafeSearch (F2, Phase 5 `image-moderator`).

### ⚠️ Blocking inconsistency: recap image cardinality

- **Frozen schema** (`recaps.image_path text not null`) and the existing
  frontend `RecapDetailScreen` (single 4:5 image) model **one image per recap**.
- **This media decision** says **max 5 images per recap**.

These cannot both hold. Multi-image needs either a `text[]` column or a
`recap_images` child table — and "no new tables / no schema redesign" forbids the
latter. **Resolution required before Phase 5** (see readiness review).

---

## 8. Privacy Matrix

| Surface | Public profile (`everyone`) | Followers-only (`followers`) | Private (`nobody`) | Blocked pair |
|---|---|---|---|---|
| **Stories** | all authenticated | accepted followers + self | self only | hidden both directions |
| **Recaps** | all authenticated (D12 — public regardless of profile) | all authenticated (D12) | all authenticated (D12) | hidden both directions |
| **Comments** | visible wherever the recap is visible | same | same | author's comments hidden to the blocked counterpart |
| **Likes** | like counts public; liker identity visible where recap is | same | same | blocked counterpart's like not shown |
| **Follow relationship** | follower/following lists visible to anyone who can see the profile | lists visible to accepted followers + self | self only | follow blocked; existing follows severed on block (Phase 6) |
| **Profile (tapped from a recap)** | visible | gated → followers-only | gated → self only | hidden |

Key asymmetry (frozen, intentional): **recaps are public** (D12 growth engine)
even for private-profile authors, but **stories follow `profile_visibility`**.
A private-profile author's recap is publicly visible, yet tapping through to
their profile is gated. Block exclusion applies to every surface; full block
enforcement lands Phase 6, with the `is_blocked_pair` guard already wired into
`plan_visible_to` and the recap/story SELECT policies will include it.

---

## 9. Scalability Review (mitigations from existing architecture only)

| Risk | Where it bites | Mitigation (existing primitives) |
|---|---|---|
| **Fan-out** — `following_posted_plan` + `new_recap_from_following` write N rows + N pushes per action | a user with many followers posts a plan/recap | Do the fan-out in an **Edge Function** (`fanout-followers`), not inline in the RPC, so the writer's request stays fast; cap fan-out and log a scaling flag at ≥1000 followers (already specified). Lazy activity feed via `feed_events` query (actor-in-my-following) instead of per-follower rows. |
| **Notification explosion** — likes/comments are high-frequency | a popular recap | **Batch likes** via the existing `recap_like_batches` table + hourly `like-batch` cron (one `recap_liked` per recap per window, threshold ≥10). Comments are not batched but are lower-volume; reply notifications dedupe to *distinct* prior commenters. |
| **Feed growth** — recap/story feeds grow unbounded | feed reads | Keep feeds **query-based with cursor pagination** (existing `get_home_feed` pattern; `LIMIT/OFFSET` capped at 100). Indexes already present: `recaps_author (author_id,created_at desc)`, `recaps_plan`. Stories self-prune at 24h (`story-cleanup` cron). |
| **Failed pushes** during fan-out | Expo outages | Existing `pending_jobs` retry queue + `job-retry` cron; `DeviceNotRegistered` pruning. |
| **feed_events table growth** | future activity feed | Write only `recap_created`/`plan_created` (not likes/views); index `feed_events_actor (actor_id,created_at desc)`; future TTL/archival when the activity feed ships. |

No recommendation engine, no new tables, no precomputed per-user feeds — all
mitigations use primitives that already exist.

---

## Implementation Readiness Review — Phase 5

**Ready to build (consistent with frozen design):**
- Recaps (create/like/unlike/comment/delete-comment/delete) + counter triggers
- Stories (create/view/delete, 24h expiry, 3-active cap) + cleanup cron
- Follows (request/accept/decline/unfollow) with S1 notification semantics
- `image-moderator` Edge Function (Vision SafeSearch) on all three buckets
- `fanout-followers` Edge Function + `following_posted_plan`; `new_recap_from_following`
- `recap_like_batches` + `like-batch` cron; `recap_reminder` / `story_expiring_soon` crons
- `feed_events` write-only for `recap_created` / `plan_created`
- Recap/story/follow RLS + **explicit service_role grants**; `notifications.recap_id` FK
- All mutations RPC-only; full pgTAP + `scripts/test-phase5.sh`

**Must resolve before Phase 5 starts (blocking):**

1. **Recap image cardinality** — single (`image_path`, frozen + current UI) vs.
   up to 5 (this brief). Options, smallest-impact first:
   - **(A) Keep single image.** Matches frozen schema + frontend; drop the
     "5 images" decision. Zero schema change. *Recommended* unless multi-image
     is a hard product requirement.
   - **(B) `image_paths text[]` (1–5) on `recaps`.** No new table; a deviation
     from the frozen `image_path text`. Requires a `CHECK (array_length 1..5)`,
     storage-quota logic, and frontend carousel work.
   - **(C) `recap_images` child table.** Cleanest relationally but **violates
     "no new tables."** Not recommended.

   Awaiting your decision (A/B/C). I will not start Phase 5 until this is set.

**Minor (non-blocking) cleanups to fold into Phase 5:**
- Tighten `recaps` bucket to 5 MB in `config.toml` (currently 10 MB).
- Add `notifications.recap_id` FK (deferred from Phase 3 by design).
- `recaps`/`stories` SELECT policies must include the block-pair guard now (so
  Phase 6 only adds `blocks` data, not policy reshape).

No new notification types, no new realtime channels, no video, no recommendation
system. The only open question is recap image cardinality.
