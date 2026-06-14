# Phase 5 — Impact Assessment (multi-image recaps)

Per approved decisions: recaps carry **1–5 images** via `image_paths text[]`
(no `recap_images` table); stories **no active-story limit**, 24h, 5 MB; no video.

## 1. Schema changes
- **`recaps.image_paths text[] not null`** (replaces the frozen `image_path text`)
  with `CHECK (array_length(image_paths,1) between 1 and 5)` and a no-null-element
  guard. This is the one approved deviation from the frozen 0009 schema.
- New tables (migration 0009): `recaps`, `recap_likes`, `recap_comments`,
  `stories`, `story_views`, `follows`, `feed_events`.
- Early-land `recap_like_batches` (batched-like push state) — same precedent as
  `contact_hashes`/`pending_jobs`/`audit_logs`.
- Add **`notifications.recap_id` FK** → `recaps(id) on delete set null` (deferred
  from Phase 3 by design).
- Fix-forward replace of `users_public`, `plan_visible_to`, `plans_select` to add
  the **follower-visibility** clause (`profile_visibility='followers'` /
  `plan_visibility='followers'`). `is_blocked_pair()` helper added now (guarded on
  the Phase-6 `blocks` table) so recap/story policies need no reshape in Phase 6.
- **No** `post_story` active-count cap (limit removed per decision).

## 2. Storage bucket changes
- **`recaps` bucket: 10 MB → 5 MB** per object (`config.toml`) — matches "5 MB per
  image". `stories` already 5 MB; `avatars` 5 MB unchanged. Image MIME only on all
  three (no video types added anywhere).

## 3. Moderation pipeline changes
- `image-moderator` must handle a recap's **multiple** objects: moderate every
  path in `image_paths`; the recap flips to `moderation='approved'` only if **all**
  pass, else the whole recap (and all its objects) is rejected/removed
  (`image_rejected` audit). Stories remain single-image.
- Moderation is keyed by recap id, not by a single path; the function loops paths.

## 4. Frontend API contract changes
- Domain type `Recap.imageUri: string` → **`imagePaths: string[]` (1–5)**.
- `RecapDetailScreen` single image → **carousel** (1–5).
- `RecapPostScreen` / `CreateStoryScreen` upload flow: recaps allow 1–5 images
  (each ≤5 MB), stories single image (≤5 MB); both call their RPC with storage
  paths after client-side compression.
- `post_recap(p_plan_id, p_image_paths text[], p_caption)` — array argument.
- No story-count limit surfaced to the client.
- These are client tasks; the backend contract (RPC signatures, row shapes) is
  delivered this phase and mapped via `src/api` later.

Proceeding to implementation.
