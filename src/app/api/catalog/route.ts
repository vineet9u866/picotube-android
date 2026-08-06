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
 * GET /api/catalog?category=<cat>&limit=<n>&page=<n>
 *
 * Paginated feed:
 *   - Page 1, category=All  → YouTube trending (full YouTube access)
 *   - Page 2+, category=All → RSS latest across all 35 channels, sliced
 *   - Any page, specific cat → RSS feeds for that category, sliced
 *
 * RSS feeds return ~15 videos per channel × 35 channels = ~500 videos,
 * giving us roughly 17 pages of content at 30 per page. When the pool
 * is exhausted, returns an empty array (signals "no more pages" to client).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const offset = (page - 1) * limit;

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    if (cat === "All" && page === 1) {
      // 1. Try YouTube trending first (full YouTube access).
      try {
        const trending = await fetchTrending(limit);
        if (trending.length > 0) {
          return NextResponse.json({
            videos: trending,
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
    // For page 1 of a specific category, also include a few catalog items
    // at the top for instant paint.
    const live = await fetchAllFeeds({ category: cat, limit: undefined });
    if (live.length === 0 && cat === "All") {
      // Last resort: catalog (page 1 only).
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

    const slice = pool.slice(offset, offset + limit);
    const hasMore = offset + limit < pool.length;

    if (slice.length === 0 && cat !== "All" && page === 1) {
      // Specific category exhausted from RSS — fall back to catalog.
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
      videos: slice,
      source: "rss-live",
      category: cat,
      page,
      hasMore,
    });
  } catch (e: any) {
    if (page === 1) {
      const catalog = filterCatalog({ category: cat, limit });
      return NextResponse.json({
        videos: catalog,
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
