import { NextResponse } from "next/server";
import { fetchTrending } from "@/lib/youtube-scraper";
import { fetchAllFeeds } from "@/lib/youtube-rss";
import { filterCatalog } from "@/lib/youtube-catalog";
import type { VideoCategory } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const VALID: (VideoCategory | "All")[] = [
  "All", "Music", "Tech", "Gaming", "Science", "Education", "Comedy",
  "Travel", "Cooking", "Sports", "Trailers", "Live", "News",
];

/**
 * GET /api/catalog?category=<cat>&limit=<n>&page=<n>&except=<comma-sep-ids>
 *
 * Paginated feed with deduplication so infinite scroll never repeats a
 * video across pages:
 *   - Page 1, category=All  → YouTube trending (full YouTube access)
 *   - Page 2+, category=All → RSS latest across all 35 channels, sliced
 *   - Any page, specific cat → RSS feeds for that category, sliced
 *
 * The `except` query param lets the client pass a comma-separated list of
 * video IDs already loaded. The server filters those out before slicing
 * the next page, so even if YouTube returns the same video on a later
 * page (very common with `&page=N`), the client never sees a duplicate.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const offset = (page - 1) * limit;
  const exceptParam = url.searchParams.get("except") || "";
  const except = new Set(
    exceptParam.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    if (cat === "All" && page === 1) {
      // 1. Try YouTube trending first (full YouTube access).
      try {
        const trending = await fetchTrending(limit * 2); // grab extra to allow dedupe
        const filtered = trending.filter((v) => !except.has(v.id));
        if (filtered.length > 0) {
          return NextResponse.json({
            videos: filtered.slice(0, limit),
            source: "youtube-trending",
            category: cat,
            page,
            hasMore: true,
          });
        }
      } catch {
        // fall through to RSS
      }
    }

    // 2. RSS pool, paginated by offset.
    const live = await fetchAllFeeds({ category: cat, limit: undefined });
    if (live.length === 0 && cat === "All") {
      if (page === 1) {
        const catalog = filterCatalog({ category: cat, limit });
        return NextResponse.json({
          videos: catalog,
          source: "catalog-fallback",
          category: cat,
          page,
          hasMore: false,
        });
      }
      return NextResponse.json({
        videos: [],
        source: "catalog-fallback",
        category: cat,
        page,
        hasMore: false,
      });
    }

    // Build a pool from RSS feeds. On page 1 of a specific category, also
    // prepend 4 catalog items for instant paint.
    let pool: any[] = live;
    if (cat !== "All" && page === 1) {
      const catalogTop = filterCatalog({ category: cat, limit: 4 });
      const seen = new Set(catalogTop.map((v) => v.id));
      pool = [...catalogTop, ...live.filter((v) => !seen.has(v.id))];
    }

    // Filter out already-seen video IDs across pages.
    const filteredPool = pool.filter((v) => !except.has(v.id));
    const slice = filteredPool.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredPool.length;

    if (slice.length === 0 && cat !== "All" && page === 1) {
      const catalog = filterCatalog({ category: cat, limit });
      const filtered = catalog.filter((v) => !except.has(v.id));
      return NextResponse.json({
        videos: filtered,
        source: "catalog-fallback",
        category: cat,
        page,
        hasMore: false,
      });
    }

    return NextResponse.json({
      videos: slice,
      source: "rss-live",
      category: cat,
      page,
      hasMore,
    });
  } catch (e: any) {
    if (page === 1) {
      const catalog = filterCatalog({ category: cat, limit });
      const filtered = catalog.filter((v) => !except.has(v.id));
      return NextResponse.json({
        videos: filtered,
        source: "catalog-fallback",
        category: cat,
        error: e?.message,
        page,
        hasMore: false,
      });
    }
    return NextResponse.json({
      videos: [],
      source: "catalog-fallback",
      category: cat,
      error: e?.message,
      page,
      hasMore: false,
    });
  }
}
