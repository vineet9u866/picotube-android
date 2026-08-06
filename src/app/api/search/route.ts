import { NextResponse } from "next/server";
import { searchYouTube } from "@/lib/youtube-scraper";
import { searchFeeds } from "@/lib/youtube-rss";
import { filterCatalog } from "@/lib/youtube-catalog";
import type { VideoCategory } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const VALID: (VideoCategory | "All")[] = [
  "All", "Music", "Tech", "Gaming", "Science", "Education", "Comedy",
  "Travel", "Cooking", "Sports", "Trailers", "Live", "News",
];

/**
 * GET /api/search?q=<query>&category=<cat>&limit=<n>
 *
 * Searches ALL of YouTube by scraping the search results page server-side.
 * No API key required — this gives full YouTube access for any query.
 *
 * Layered fallback strategy:
 *   1. YouTube full search (scraped)            ← primary, full YouTube access
 *   2. YouTube RSS feed search (35 channels)    ← secondary, fresh content
 *   3. Curated catalog filter                   ← emergency fallback
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const trimmed = query.trim();
  if (!trimmed) {
    // Empty query → return RSS latest instead of search results.
    const live = await searchFeeds("", { category: cat, limit }).catch(() => []);
    return NextResponse.json({ videos: live, source: "rss-live", query: "", category: cat });
  }

  // 1. Full YouTube search (scraped — access to every video on YouTube).
  let scraped: Awaited<ReturnType<typeof searchYouTube>> = [];
  let scrapeError: string | undefined;
  try {
    scraped = await searchYouTube(trimmed, { limit, category: cat });
  } catch (e: any) {
    scrapeError = e?.message;
  }

  if (scraped.length > 0) {
    return NextResponse.json({
      videos: scraped,
      source: "youtube-search",
      query: trimmed,
      category: cat,
    });
  }

  // 2. RSS feed search (limited to our 34 channels but always works).
  const rss = await searchFeeds(trimmed, { category: cat, limit }).catch(() => []);

  // 3. Catalog fallback.
  const catalog = filterCatalog({ query: trimmed, category: cat, limit });

  const merged = [...rss, ...catalog.filter((v) => !rss.some((r) => r.id === v.id))].slice(0, limit);

  if (merged.length === 0) {
    return NextResponse.json({
      videos: [],
      source: "empty",
      query: trimmed,
      category: cat,
      error: scrapeError,
    });
  }

  return NextResponse.json({
    videos: merged,
    source: rss.length > 0 ? "rss-fallback" : "catalog-fallback",
    query: trimmed,
    category: cat,
    error: scrapeError,
  });
}
