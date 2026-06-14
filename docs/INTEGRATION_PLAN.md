# HopOn — Integration Plan & UI Impact Report

Maps every business decision taken during backend implementation (Phases 1–7 +
safety) to the frontend screens it affects, and sequences the work to wire the
Expo app off `src/mocks/*` onto the real RPCs. **No backend redesign** — this
identifies UI consequences and surfaces gaps; backend stays frozen.

Sources: the frozen execution doc, NOTIFICATION_MATRIX, SOCIAL_GRAPH_MATRIX,
SAFETY_INTERACTION_MATRIX, MODERATION_STATUS_UX, and the shipped migrations.

---

# Part A — UI Impact Report

## A.0 Contract changes (type-level — affect every consuming screen)

| Frontend type | Today | Backend reality | Action |
|---|---|---|---|
| `Recap.imageUri: string` | single image | `recaps.image_paths text[]` (1–5) + `moderation` | → `imagePaths: string[]`, add `moderation` |
| `MemberStatus` | no `noshow` | enum has `noshow` (D7) | → add `'noshow'` |
| `User.isVerified: boolean` | bool | `verification_level` none/phone/id (D1) | → derive badge; add Verified+ for `id` |
| `User.interests: string[]` | present | ✅ `users.interests text[]` (0003a) | self-edit via UPDATE; on `users_public` |
| `NotifType` (7) | 7 types | **41 types** | → expand union; `NotifRow` icon/copy per type |
| `Story` | no moderation/seen | `moderation`, `expires_at`, `story_views` | → add fields |
| `User.attendanceScore` | `number\|null` | null until 3 events (D4) | ✅ already nullable — render "New" not 0% |
| profile/plan visibility | present | enforced server-side | ✅ aligned |
| social links | ig/linkedin/fb | `ig_handle`/`linkedin_handle`/`fb_handle` | ✅ aligned (rename in mapper) |

## A.1 Onboarding

| Screen | Decision driving change | UI change | Type |
|---|---|---|---|
| Login / SignupPhone / SignupOtp | Phone OTP auth (Twilio) | wire Supabase Auth phone OTP send/verify | flow |
| SignupName/Dob/Gender/Neighbourhood | `complete_signup` collects all, called once after these steps | hold values, call `complete_signup` at end; **gender is write-once, never displayed** (D11) | flow |
| SignupDob | **F1 min age 18** (DB CHECK + `underage` error) | client-side ≥18 guard + handle `underage` | validation |
| SignupPhoto / ProfileEdit avatar | avatar → `avatars` bucket (5MB) | direct upload; ⚠️ **avatars are NOT moderated** (image-moderator covers only recaps/stories) — see A.5 | upload |
| Interests | ✅ `users.interests` (0003a) | persist via `UPDATE users SET interests` (after `complete_signup`) | wiring |
| ContactsSync | hashed match (D10): SHA-256 of `+E.164`; **must run after `complete_signup`** (FK) | client-side hashing → `contacts-match`; order after signup | flow + crypto |
| PeopleToFollow | contact matches + `create_invites` for non-users | render matches; `follow_user`; optional invite | wiring |

## A.2 Plans (Home / Create / Plan loop)

| Screen | Decision | UI change | Type |
|---|---|---|---|
| Home / HomeMap | `get_home_feed` (geo + visibility + block filtered) | swap mock; urgency grouping from `starts_at` | data |
| Search | `search_plans` / `search_users` | swap mock | data |
| Create | **14-day max window (D8)**; **≤5 active plans**; gender_pref strict map; cost enum | add `maximumDate=now+14d`; handle `too_many_active_plans`/`starts_too_far` | validation + errors |
| Create (spots) | capacity **includes host**, joinable = capacity−1 | "Including you" already correct — confirm mapping | confirm |
| Plan | `get_plan_detail` (host+joiners+familiar_count); `join_plan` | HOP ON vs Request by `plan_type`; **`gender_mismatch` error UX**; full/closed states | data + errors |
| PlanEdit | `update_plan` **does NOT edit capacity** | **remove capacity/spots editing** | ⚠️ control removal |
| PlanHost | real pending count; attendees; `end_plan` | replace hardcoded `PENDING_COUNT`; wire end | data |
| PlanRequests / PlanApproved / PlanDeclined | `approve_request`/`decline_request` (+ `plan_full` on approve) | wire; handle `plan_full` | wiring |
| PlanJoined/Requested/Posted/Expired | confirmation/state screens | wire status | minor |
| PlanEnded | **host no-show vote (D7)** for present attendees | **NEW control**: "Host didn't show?" → `vote_host_noshow`; + endorse CTA | new control |
| PlanCancelConfirm / PlanLeaveConfirm | `cancel_plan` / `leave_plan` | wire | wiring |

## A.3 Endorsements & Trust

| Screen | Decision | UI change | Type |
|---|---|---|---|
| **Endorse** | **Peer endorsements (D6)** + host attendance marking; 48h window (S2); no-show | **MAJOR REWORK**: two modes — *host* (mark present/no-show + tag) vs *present peer* (tag only); `submit_endorsements`; window-closed + `not_present` errors | major |
| FamiliarFaces | real `plans_together` / `last_met_at`; **host included (D5)**; threshold 1 (DA) | replace hardcoded "2 plans together / 3d ago" with real values | data |
| Profile / ProfileOther | endorsements **top-5 with counts (DB)** via `get_endorsement_summary`; attendance null→"New" | wire summary; null score handling | data |
| HostCard (molecule) | attendance null | render "New" not "null%/0%" | data |

## A.4 Social (Recaps / Stories / Follows)

| Screen | Decision | UI change | Type |
|---|---|---|---|
| Recaps | `get_recaps_feed` + `get_stories_feed`; recaps public (D12) | swap mock; story bubbles w/ seen ring | data |
| RecapPost | **1–5 images** (image_paths); upload then `post_recap` | **multi-image picker (1–5)**, per-file ≤5MB | major |
| RecapPosted | **moderation pending** | **NEW "In review" state** → realtime flip to Live/Couldn't post (MODERATION_STATUS_UX) | new state |
| RecapDetail | **carousel (1–5)**; `like_recap`/`unlike_recap` (batched), `comment_recap`; **report recap/comment** (Safety #1); moderation | carousel; like/comment wiring; **NEW report entry points**; hide rejected | major |
| CreateStory | single image; **moderation pending**; 24h; **no active limit** | upload + "In review"; remove any story-count cap | moderation state |
| StoryViewer | `record_story_view`; **report story** (#1); expiry | record view; **NEW report-story**; expired handling | data + report |

## A.5 Notifications

| Screen | Decision | UI change | Type |
|---|---|---|---|
| Notifications | **41 types**; realtime delivery; `mark_notifications_read`; block filter (#8) | `NotifRow` per-type icon/copy for all 41; realtime subscribe; mark-read | data + expansion |
| SettingsNotifications | **41 preference-controlled types** (3 silent, 6 mandatory not shown); push token registration | expand 7 toggles → grouped matrix (per NOTIFICATION_MATRIX §"Settings"); `register_push_token` on foreground; `set_notification_pref` | expansion |

## A.6 Chat

| Screen | Decision | UI change | Type |
|---|---|---|---|
| Chat | `send_message`; **realtime** (plan:{id}:chat); **chat-lock (D3)**: closed/`chat_archived` after 30d; **@mention**; **report message (#1)** | realtime subscribe; send via RPC; **read-only states** (cancelled/expired/archived); mention rendering; **NEW report-message** | major |

## A.7 Profile / Follows / Settings

| Screen | Decision | UI change | Type |
|---|---|---|---|
| Profile | counts/score/endorsements/verification from backend | wire mappers | data |
| ProfileOther | **block/unblock**, **report user**; followers-only gating; **no gender shown** | block/unblock controls; report; handle hidden (followers-only/blocked) profile | controls |
| ProfileEdit | editable = name, avatar, bio, neighbourhood, visibility, social — **NOT handle/gender/dob** | restrict editable fields | control scope |
| FollowList | follow states pending/accepted; **accept/decline requests** (S1) | request inbox actions (`accept_follow`/`decline_follow`); follow/unfollow | controls |
| SettingsBlocked | real block list + unblock | wire `blocks` + `unblock_user` | data |
| SettingsDelete | **soft delete + 30-day grace (F3)**; `export_my_data` | copy: "recoverable for 30 days"; **NEW data-export action** | copy + new |
| SettingsNeighbourhood / SettingsPrivacy | update profile fields/visibility | wire | wiring |
| ReportUser / ReportPlan / ReportForm | `submit_report` (user/plan); ≤10/day | wire; handle `rate_limited` | wiring |
| ReportProblem | generic app-problem report | ⚠️ **no backend** (A.8) | gap |

## A.8 Cross-cutting NEW UI (no screen exists today)

| Concern | Decision | Required UI |
|---|---|---|
| **Suspended state** | suspension is write-only; `account_suspended` on every write | global **read-only banner / blocked-action state** when `account_status='suspended'` |
| **Moderation status** | recaps/stories pending→approved/rejected | shared "In review → Live / Couldn't post" treatment (MODERATION_STATUS_UX) |
| **Error mapping** | typed `ApiErrorCode`s | central error→toast map (`gender_mismatch`, `plan_full`, `rate_limited`, `too_many_active_plans`, `chat_archived`, `endorsement_window_closed`, `not_present`, `account_suspended`, `handle_taken`, `underage`, `blocked`, …) |
| **Realtime** | 4 channels (chat, members, notifications, moderation) | subscription hooks + reconnect handling |

## A.9 Backend gaps surfaced by integration (flag only — no redesign now)

| # | Gap | Decision | Status |
|---|---|---|---|
| G1 | `User.interests` had no DB column | **Add it** | ✅ **Done** — `users.interests text[]` (migration 0003a), exposed on `users_public`, self-editable; Interests screen + ProfileEdit persist via direct `UPDATE` (no RPC) |
| G2 | Avatars not moderated | **No moderation** | ✅ Confirmed — avatars upload without Vision; documented as intended |
| G3 | ReportProblem has no backend | **Route to email/support** | ✅ Confirmed — `ReportProblem` opens a mailto/support link; no backend |
| G4 | No DM / direct chat | **No DMs** | ✅ Confirmed — chat is plan-group only by design |

All four resolved. `interests` is the only backend change; the rest are product confirmations. The `Interests` onboarding screen is now unblocked.

---

# Part B — Integration Plan

## B.1 API layer (new — `src/api/**`)

Per the frozen frontend architecture (screens own zero data-fetching today via
mocks), introduce a thin layer so screens swap `@/mocks` → `@/api` with minimal change:

```
src/api/
  client.ts        supabase-js singleton (EXPO_PUBLIC_* env), session persistence (expo-secure-store)
  auth.ts          phone OTP, session, complete_signup
  mappers.ts       snake_case rows → existing camelCase view-models
                   (+ derived: minutesUntilStart, isMine, joinerIds, spotsRemaining)
  errors.ts        ApiErrorCode → user message map
  plans.ts / recaps.ts / stories.ts / follows.ts / notifications.ts / trust.ts / safety.ts
  realtime.ts      channel subscription hooks
  storage.ts       image compress (expo-image-manipulator) + upload + path return
  hooks/           react-query (or SWR) wrappers per query
```

**Mapping is where the contract deltas (A.0) are absorbed** — screens keep their
current prop shapes wherever possible; mappers translate. Deltas that change the
UI itself (multi-image, moderation state, endorse rework) are unavoidable and
listed in Part A.

## B.2 Cross-cutting (do first — everything depends on these)

1. `client.ts` + session + `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`
2. `errors.ts` toast mapping for all `ApiErrorCode`s
3. Suspended-account global gate (A.8)
4. `register_push_token` on foreground + notification permission
5. Realtime subscription hook + reconnect
6. Storage upload helper (compress → upload → path) — shared by avatar/recap/story

## B.3 Screen rollout (sequenced to the backend phases)

| Wave | Screens | Backend |
|---|---|---|
| **W1 Identity** | Login, Signup*, ContactsSync, PeopleToFollow, Neighbourhood | Phase 1 |
| **W2 Core loop** | Home, HomeMap, Search, Create, Plan, PlanHost, PlanRequests, PlanEdit, Plan* confirmations | Phase 2 |
| **W3 Realtime** | Chat, Notifications, SettingsNotifications | Phase 3 |
| **W4 Trust** | PlanEnded (no-show), Endorse (rework), FamiliarFaces, Profile score/endorsements | Phase 4 |
| **W5 Social** | Recaps, RecapPost (multi-image), RecapDetail (carousel/report), CreateStory, StoryViewer, ProfileOther, FollowList | Phase 5 |
| **W6 Safety** | SettingsBlocked, ReportUser/Plan/Form, report entry points (recap/story/comment/message), SettingsDelete (export) | Phase 6 + #1 |
| **W7 Growth** | feature-flag gating, invites, onboarding nudges surfacing | Phase 7 |

Each wave: wire data → handle the Part-A UI changes → handle errors → verify on device (the `run`/`verify` skills) before the next.

## B.4 Definition of done per screen
- Reads via `@/api` (no `@/mocks` import)
- All listed Part-A UI changes implemented
- Error codes mapped to toasts
- Realtime where applicable
- Verified on a physical device against the local stack (then prod)

## B.5 Highest-risk / highest-effort items
1. **Endorse rework** (host + peer modes) — A.3
2. **Multi-image recap + carousel** — A.4
3. **Moderation "in review" states + realtime** — A.4/A.8
4. **Chat realtime + lock states + report** — A.6
5. **41-type notifications + prefs** — A.5

## B.6 Pre-work decisions — all resolved
- **G1 interests** → added (`users.interests`, migration 0003a). ✅
- **G2 avatar moderation** → not moderated (intended). ✅
- **G3 ReportProblem** → email/support link, no backend. ✅
- **G4 DMs** → none; plan-group chat only. ✅

No blockers remain. Client integration wires against a frozen, tested backend.
