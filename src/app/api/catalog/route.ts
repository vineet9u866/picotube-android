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
 * GET /api/catalog?category=<cat>&limit=<n>
 *
 * For category=All: returns YouTube's trending feed (full YouTube access).
 * For a specific category: returns latest videos from our RSS channels in
 * that category + a few catalog items as instant paint.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    if (cat === "All") {
      // 1. Try YouTube trending first (full YouTube access).
      try {
        const trending = await fetchTrending(limit);
        if (trending.length > 0) {
          return NextResponse.json({
            videos: trending,
            source: "youtube-trending",
            category: cat,
          });
        }
      } catch {
        // fall through to RSS
      }

      // 2. Fallback: RSS latest across all 34 channels.
      const live = await fetchAllFeeds({ category: "All", limit });
      if (live.length > 0) {
        return NextResponse.json({
          videos: live,
          source: "rss-live",
          category: cat,
        });
      }

      // 3. Last resort: catalog.
      const catalog = filterCatalog({ category: "All", limit });
      return NextResponse.json({ videos: catalog, source: "catalog-fallback", category: cat });
    }

    // Specific category: use RSS feeds for that category.
    const live = await fetchAllFeeds({ category: cat, limit });
    const catalogTop = filterCatalog({ category: cat, limit: 4 });
    const seen = new Set(catalogTop.map((v) => v.id));
    const merged = [...catalogTop, ...live.filter((v) => !seen.has(v.id))].slice(0, limit);

    if (merged.length === 0) {
      const catalog = filterCatalog({ category: cat, limit });
      return NextResponse.json({ videos: catalog, source: "catalog-fallback", category: cat });
    }

    return NextResponse.json({
      videos: merged,
      source: "rss-live",
      category: cat,
    });
  } catch (e: any) {
    const catalog = filterCatalog({ category: cat, limit });
    return NextResponse.json({
      videos: catalog,
      source: "catalog-fallback",
      category: cat,
      error: e?.message,
    });
  }
}
