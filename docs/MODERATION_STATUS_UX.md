# HopOn — Moderation Status & Posting UX (recaps & stories)

How the Instagram-style "Posting → In review → Live" experience is driven by the
backend. The animation/progress bar is frontend; this document defines the
**backend contract** the client renders against. No human is in this loop —
moderation is automated Google Vision SafeSearch (`image-moderator`).

## State machine (`recaps.moderation` / `stories.moderation`)

```
        client uploads images to Storage (shows upload % per file)
                              │
                  post_recap / post_story (paths)
                              │
                        moderation = 'pending'  ── INSERT webhook ──▶ image-moderator
                              │                                            │
              (author sees own pending row via RLS;                  Vision SafeSearch
               realtime UPDATE will arrive)                          per image
                              │                              ┌──────────┴──────────┐
                              ▼                              ▼                     ▼
                     ┌─────────────────┐            moderation='approved'   moderation='rejected'
   UI: "Posting…"    │   In review     │            + notifications         + objects removed
   (optimistic       │  (spinner/bar)  │            + feed_event            + image_rejected audit
    local preview)   └─────────────────┘                   │                     │
                                                            ▼                     ▼
                                                     UI: "Live" ✓         UI: "Couldn't post"
                                                  (enters the feed)       (guidelines + retry/delete)
```

## How the client gets each transition

| Stage | Backend signal | Client renders |
|---|---|---|
| Uploading | Storage upload progress (per file, client-side) | Per-image % bar (1–5 images for recaps) |
| Submitted | `post_recap`/`post_story` returns the row, `moderation='pending'` | Optimistic card with the local preview + "In review" spinner |
| In review | row is `pending`; author can `SELECT` own row (RLS `author_id = auth.uid()`) | Keep spinner; typically 1–3 s with Vision |
| Approved | **realtime UPDATE** on `recaps`/`stories` (author subscribed to own rows) → `moderation='approved'` | Swap spinner → "Live"; item now appears in `get_recaps_feed` / story bubble |
| Rejected | **realtime UPDATE** → `moderation='rejected'` | "Couldn't post — violates community guidelines"; offer Retry (re-upload) or Delete |

## Why this works
- **Author-visible pending:** `recaps_select` / `stories_select` include
  `author_id = auth.uid()`, so the poster sees their own item in every state;
  everyone else sees it only once `approved`.
- **Live flips:** `recaps` and `stories` are on the `supabase_realtime`
  publication (0015c). Realtime enforces RLS, so the author receives the
  moderation UPDATE on their own row; no polling.
- **Auto-start:** `recaps`/`stories` INSERT webhooks dispatch `image-moderator`
  immediately (client uploaded the bytes first, so they exist).
- **No stuck spinners:** `fn_redispatch_stale_moderation` (every 5 min)
  re-dispatches anything `pending` > 5 min if a call was lost.

## Recommended client subscription

```ts
// after post_recap returns { id, moderation: 'pending' }
supabase
  .channel(`recap-moderation:${recapId}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'recaps', filter: `id=eq.${recapId}` },
      ({ new: row }) => setStatus(row.moderation))   // 'approved' | 'rejected'
  .subscribe();
```
Stories use the same pattern on `table: 'stories'`.

## Notes
- **No notification on the author's own moderation result** — the realtime row
  flip carries it (a notification would be redundant self-noise). Followers/host
  are notified only on `approved` (existing `new_recap_*` types).
- **Rejection reason** is coarse at v1 ("violates guidelines"); the precise Vision
  categories live in the `image_rejected` audit row, not surfaced to the user.
- **Latency:** with Vision, the "In review" state is typically brief (~1–3 s);
  the UX should still be designed to tolerate longer (queue/outage) gracefully
  via the persisted `pending` state, not a fixed timer.
```
