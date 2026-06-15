# Wave 5 (Social) — Implementation Report

**Date:** 2026-06-15
**Scope:** End-to-end integration of the Social wave — recaps, stories, follows,
profiles, reporting/blocking, account export/delete — wiring the existing UI to
the frozen Phase 5/6 backend contracts.

**Status:** ✅ Client integration complete & type-clean (`tsc --noEmit` exit 0).
Backend regression green (**417 pgTAP pass**; Wave 5 added no migrations).
Live-smoke-verified on the iOS simulator (Arjun). **Two backend gaps block the
image-upload and "my-plans" flows — these require migrations/RLS changes, which
are STOP conditions, so they are flagged here (not applied) for your approval.**

---

## 1. What was built

### API layer (new)
- `src/api/recaps.ts` — `getRecapsFeed`, `getRecapDetail`, `postRecap`,
  `like/unlikeRecap`, `commentRecap`, `deleteComment`, `deleteRecap`, `getUserRecaps`.
- `src/api/stories.ts` — `getStoriesFeed` (grouped by author), `postStory`,
  `recordStoryView`, `deleteStory`.
- `src/api/follows.ts` — `followUser`/`accept`/`decline`/`unfollow`,
  `getFollowState`, `getMyFollowers`, `getMyFollowing`, `getMyFollowCounts`,
  `getPendingRequestCount`.
- `src/api/safety.ts` — `submitReport`, `blockUser`, `unblockUser`,
  `getBlockedUsers`, `isBlocked`.
- `src/api/social.ts` — shared embedded-author mapper.
- `src/api/storage.ts` — added `recapImageUrl`/`storyImageUrl`/`recapImageUrls`
  resolvers + `uploadImage`/`uploadImages` (RN `fetch().blob()` → bucket; returns
  object path).
- `src/api/users.ts` — `getPublicProfile`, `updateMyProfile` (+ `ProfileUpdate`).
- `src/api/auth.ts` — `exportMyData` (wraps `export_my_data`).
- `src/api/trust.ts` — `getFamiliarFaceWith` (crossed-paths for ProfileOther).
- `src/api/plans.ts` — `getMyPlans`, `getUserHostedPlans` (⚠️ see Gap #1).
- `src/api/hooks/useFocusResource.ts` — generic fetch-on-focus + refresh/optimistic-set hook.

### Screens wired (off mocks → real backend)
| Screen | Backend | Verified |
|---|---|---|
| Recaps feed | `get_recaps_feed` + `get_stories_feed`, familiar/near split via familiar-faces, story bubbles w/ seen ring | ✅ live (empty state) |
| RecapDetail | `get_recap_detail`, like/unlike, comment, delete, follow author, report recap/comment, image carousel (1–5), hide-rejected | ✅ tsc; logic verified |
| RecapPost | multi-image picker + `uploadImages` + `post_recap`; plan now **required** | ⚠️ blocked by Gap #1 & #2 |
| RecapPosted | "in review" moderation state | ✅ |
| CreateStory | single image + `uploadImage` + `post_story`; "in review" | ⚠️ blocked by Gap #2 (live-confirmed 403) |
| StoryViewer | author-group paging, `record_story_view`, report-story, delete-own, expiry; **like/comment removed (no backend)** | ✅ live (renders) |
| Profile (own) | real follow counts, familiar faces, endorsements, recaps tab; hosted/joined tabs (⚠️ Gap #1) | ✅ live |
| ProfileOther | `getPublicProfile`, follow/unfollow/state, block/unblock, report (inline), crossed-paths, recaps tab, followers-only/blocked gating | ✅ tsc; recaps/follow/block verified |
| FollowList | self followers/following, accept/decline pending, follow/unfollow; other users gated | ✅ tsc |
| SettingsBlocked | `getBlockedUsers` + unblock (generic labels — see Gap #3) | ✅ tsc |
| ReportUser / ReportPlan / ReportForm | `submit_report` + rate-limit handling | ✅ tsc |
| ReportProblem | support-email (mailto) — no backend (gap G3) | ✅ |
| ProfileEdit | real load + `updateMyProfile` + avatar upload + interests; handle now read-only | ⚠️ avatar blocked by Gap #2; text fields OK |
| SettingsDelete | `delete_account` (already wired) + `export_my_data` (new, via Share) + 30-day-grace copy | ✅ tsc |

---

## 2. UI changes made (to support backend business rules)
1. **RecapPost — plan is now required.** `post_recap` mandates `p_plan_id` (you
   must be an active member of a started plan). The link-a-plan section changed
   from optional to required, with "Which plan was this?" + a disabled-until-picked
   Share button.
2. **RecapPosted — "in review" state.** Recaps are moderation-`pending` until
   approved, so the success screen now says "in review, appears once approved"
   instead of "now visible to everyone".
3. **CreateStory — "in review" messaging** on post (stories are moderation-gated).
4. **StoryViewer — removed likes & comments.** Stories have no like/comment
   backend (only `record_story_view`). The right-rail now shows Report (others) /
   Delete (own) + Share; paging is per-author-group (Instagram model).
5. **ProfileEdit — handle is read-only** (immutable; the `users` column GRANT
   doesn't expose handle/gender/dob to clients). Shown with a lock + helper text.
6. **ProfileOther — followers-only & blocked gating.** Private/blocked profiles
   show a gated card (no handle) with "Request to follow" / "Unblock"; the
   "Joined" tab shows a "private" note (not client-queryable for others).
7. **SettingsDelete — 30-day grace copy** + a "Download my data" action.
8. **Report flows** route through typed reasons → `submit_report` with friendly
   `rate_limited` handling. ProfileOther/RecapDetail/StoryViewer report inline
   (Alert) so they work across every navigator they're registered in.

---

## 3. Discovered issues (by severity)

### 🔴 CRITICAL — needs a backend change (STOP-flagged, not applied)

**Gap #2 — Image uploads are blocked (no storage RLS policies).**
`storage.objects` has RLS **enabled with zero policies**, so every authenticated
upload returns `403 new row violates row-level security policy`. This blocks
**recap photos, story photos, and avatar changes** (all of `uploadImage`).
Live-confirmed: posting a story in the simulator → "Couldn't share your story".
Affects Wave 1 avatar upload too (pre-existing, not introduced by Wave 5).

*Recommended fix (own-folder policy per public bucket):*
```sql
-- 20260616_storageRLS.sql
create policy "own_folder_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','recaps','stories')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own_folder_update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars','recaps','stories')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own_folder_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','recaps','stories')
         and (storage.foldername(name))[1] = auth.uid()::text);
-- public read already works via getPublicUrl (buckets are public).
```
(Client already uploads to `${auth.uid()}/...` paths, so this policy matches.)

**Gap #1 — No server read-path for "a user's plans" (users-column cascade).**
Direct `plans` / `plan_members` selects fail for `authenticated` with
`42501 permission denied for table users` — the `plans_select` RLS subquery reads
`users.deleted_at`/`account_status`, columns not in the column GRANT. There is no
SECURITY DEFINER RPC that lists a user's plans (`get_home_feed` is geo +
active+future only). This blocks: **RecapPost's plan picker** (so recaps can't be
posted at all from the tab), **CreateStory's plan link**, and the **Profile /
ProfileOther Hosted & Joined tabs** (Profile shows Hosted·0/Joined·0 despite the
trust grid reading 15/28).

*Recommended fix (additive read RPC, mirrors `get_plan_attendees`):*
```sql
-- 20260616_get_my_plans.sql
create or replace function get_my_plans()
returns setof plans language sql stable security definer set search_path = public as $$
  select p.* from plans p
  where p.host_id = auth.uid()
     or exists (select 1 from plan_members m where m.plan_id = p.id and m.user_id = auth.uid())
  order by p.starts_at desc;
$$;
revoke execute on function get_my_plans() from anon, public;
grant execute on function get_my_plans() to authenticated, service_role;
-- (optional get_user_plans(p_user_id) for ProfileOther hosted, host-only + visibility-filtered)
```
Then swap `getMyPlans`/`getUserHostedPlans` bodies to a single `rpc()` call
(call-sites + mappers already in place; ~5-line change each).

### 🟡 MEDIUM
**Gap #3 — Blocked-user names not resolvable.** Blocked users are excluded from
`users_public` (by `is_blocked_pair`), so SettingsBlocked shows generic "Blocked
member" rows with an unblock action. Cosmetic; unblock works. Would need a
SECURITY DEFINER `get_blocked_users()` RPC to show names/avatars.

**No Wave 5 dev seed.** No recaps/stories/follows are seeded, so the feeds show
empty states for fresh test users. Recommend a `seed_dev_wave5.sql` once Gap #2
lands (needs uploaded objects for images to resolve).

### 🟢 LOW
- StoryViewer "Share" is a local placeholder (no native share sheet wired) — by design, no backend.
- ReportProblem has no in-app backend (gap G3, documented) — composes a support `mailto:`.

### Carried (not Wave 5)
- Session-restore needs `expo run:ios` (in-memory storage fallback; sessions drop on full JS reload).
- Push untestable on simulator.
- Dev-gear FAB overlaps bottom-right buttons in dev builds (confirm `__DEV__`-gated).
- Auto-end credits `plans_hosted` for 0-attendee plans (Trust note).

---

## 4. Verification
- **`tsc --noEmit`**: exit 0 across all new/changed files.
- **pgTAP**: `supabase test db` → **417 pass** (no Wave 5 migrations; chain resets clean).
- **Live simulator (Arjun, iPhone 17 Pro / iOS 26.5):**
  - Recaps feed loads via `get_recaps_feed` + `get_stories_feed` (empty state, no redbox). ✅
  - RecapPost renders required-plan UI; plan picker correctly surfaces the load failure (Gap #1). ✅
  - CreateStory: photo picker → crop → composer all work; **post → 403 (Gap #2)** surfaced as a clean error toast. ✅ (failure handled, no crash)
  - Profile: real follow counts (0/0), familiar faces (Meera), endorsements (Reliable·1), trust grid; tabs render (Hosted·0/Joined·0 = Gap #1). ✅
  - Direct-select APIs confirmed working for `recaps`, `blocks`, `familiar_faces`, `follows` (REST probes). ✅

---

## 5. Launch-readiness (Waves 1–5)
- **Waves 1–4 + Trust v2:** ✅ READY (unchanged; 417 pgTAP green).
- **Wave 5 social — read/social/safety surfaces:** ✅ READY (feeds, profiles,
  follow/accept/decline/unfollow, block/unblock, report, comments, likes,
  export/delete, moderation states).
- **Wave 5 image + plan-picker surfaces:** 🔴 BLOCKED on Gap #1 (my-plans RPC)
  and Gap #2 (storage RLS). Both are small additive backend changes (SQL above).
  Once applied, post-recap / post-story / avatar-change / profile-history go green
  with no further client work (call-sites + mappers already wired).

**Recommendation:** approve the two flagged migrations (Gap #1 + #2). They are
additive, follow existing patterns (SECURITY DEFINER read + own-folder storage
RLS), and don't alter any product/trust/moderation model — after which Wave 5 is
fully launch-ready.
