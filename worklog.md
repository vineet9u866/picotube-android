---
Task ID: infinite-scroll-comments-desc
Agent: main (Super Z)
Task: Add infinite scroll on home and watch (related) pages, plus video descriptions and comments on the watch page.

Work Log:
- Extended `src/lib/youtube-scraper.ts`:
  - Added `description?: string` field to `ScrapedVideo`.
  - Added `page` parameter to `searchYouTube()` (uses YouTube's `&page=N` URL param).
  - Extracted description from `ytInitialPlayerResponse.videoDetails.shortDescription` in `fetchVideoMetadata()`.
  - Added `fetchRelatedVideos(videoId)` — scrapes YouTube watch page for related videos.
  - Added `fetchRelatedVideosContinuation(token)` — uses InnerTube `/next` API for pagination.
  - Added `fetchVideoComments(videoId, { continuationToken })` — scrapes watch page for the comments-section continuation token, then calls InnerTube `/next` to fetch actual comments.
  - Added `ScrapedComment` and `CommentsResult` types.
  - Added `parseComments()` that handles BOTH the modern entity-batch format (`frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload`) and the legacy `commentThreadRenderer` format.
  - Added `parseCommentEntity()` to extract author, text, likes, published time, avatar, reply count from the modern format.
  - Added `findContinuationToken()` and `findCommentsToken()` helpers.
  - Added `callInnertube()` helper using the public InnerTube API key + WEB client context.
  - Updated `findVideoRenderers()` to handle bare `lockupViewModel` objects (newer watch page format) in addition to `richItemRenderer`-wrapped ones.
  - Updated `normalizeLockupViewModel()` to support both layout variants — direct `metadataRows` (channel page) and `metadata.contentMetadataViewModel.metadataRows` (watch page).

- Updated API routes:
  - `src/app/api/catalog/route.ts` — added `page` parameter and `hasMore` field. Page 1 of "All" returns YouTube trending; subsequent pages slice the RSS pool. Specific categories slice their RSS pool.
  - `src/app/api/search/route.ts` — added `page` parameter, passes through to `searchYouTube()`. Page >1 with no results returns empty array (no fallback mixing).
  - `src/app/api/video/[id]/route.ts` — reordered lookup: YouTube scrape FIRST (gives description), then catalog, then RSS cache, then minimal.
  - `src/app/api/comments/[id]/route.ts` (NEW) — fetches comments via InnerTube API. Supports `token` param for pagination.
  - `src/app/api/related/[id]/route.ts` (NEW) — fetches related videos via watch-page scrape. Supports `token` param for InnerTube continuation.

- Updated frontend:
  - `src/store/app-store.ts` — added `description?: string` to `VideoMeta`.
  - `src/hooks/use-infinite-scroll.ts` (NEW) — IntersectionObserver-based hook. Uses a **callback ref** (not a useEffect) so the observer is attached as soon as the sentinel DOM node mounts. Re-fires after every load completes in case the sentinel is still in view (short-page case). Returns a `RefCallback<T>`.
  - `src/components/picotube/home-view.tsx` — migrated from `useQuery` to `useInfiniteQuery`. Renders each page in a `Fragment` with a divider. Shows "Loading more…" spinner and "You've reached the end" indicator.
  - `src/components/picotube/search-view.tsx` — same migration to `useInfiniteQuery`.
  - `src/components/picotube/watch-view.tsx` — major rewrite:
    - Replaced search-based related-videos with the new `/api/related/[id]` endpoint (true YouTube recommendations).
    - Added infinite scroll on related videos (continues via InnerTube token).
    - Added a collapsible description box below the channel info. "Show more" / "Show less" toggle for long descriptions.
    - Added a comments section with avatar, author, timestamp, like count, reply count, and full text. Skeleton loaders while fetching. Infinite scroll loads more comments via continuation tokens.
    - "End of comments" and "End of related" indicators when there are no more pages.

- Debugging notes:
  - YouTube comments use a new "entity-batch" format where actual data lives in `frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload`. The `commentThreadRenderer` items only hold a `commentKey` that references the entity payload. Had to write a parser for this new format.
  - The watch page's related videos use bare `lockupViewModel` (not wrapped in `richItemRenderer`). Had to update `findVideoRenderers()` to detect these.
  - Initial `useInfiniteScroll` hook used a `useEffect` to set up the IntersectionObserver, but the sentinel ref wasn't attached yet when the effect ran. Fixed by switching to a callback ref so the observer is set up the instant the node mounts.
  - Verified infinite scroll triggers up to 8+ pages of catalog and 8+ pages of comments.

Stage Summary:
- All four requested features are implemented and verified working:
  1. ✅ Home page infinite scroll — paginates through YouTube trending (page 1) then RSS feeds (pages 2+), loading 24 videos per page. Verified up to 8 pages = ~181 video cards loaded.
  2. ✅ Watch page related-videos infinite scroll — uses InnerTube continuation API for pagination. Shows ~20 related videos initially with the ability to load more.
  3. ✅ Video description — extracted from `ytInitialPlayerResponse.videoDetails.shortDescription`. Shown in a collapsible box with "Show more"/"Show less" for long descriptions.
  4. ✅ Comments — fetched via YouTube InnerTube API (the same API YouTube's own web client uses). Shows author handle, avatar, comment text, like count, timestamp, and reply count. Infinite scroll loads more comments via continuation tokens.

- All API endpoints return real YouTube data — no API key required, no mocks.
- Type check passes (`tsc --noEmit`).
- Dev server running cleanly with no console errors.
