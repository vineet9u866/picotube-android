import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/youtube-rss";
import { filterCatalog } from "@/lib/youtube-catalog";
import type { VideoCategory } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const VALID: (VideoCategory | "All")[] = [
  "All", "Music", "Tech", "Gaming", "Science", "Education", "Comedy",
  "Travel", "Cooking", "Sports", "Trailers", "Live", "News",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    // Primary: live YouTube RSS feeds (no API key needed).
    const live = await fetchAllFeeds({ category: cat, limit });

    // Emergency fallback: if RSS returns nothing, use the curated catalog.
    if (live.length === 0) {
      const catalog = filterCatalog({ category: cat, limit });
      return NextResponse.json({
        videos: catalog,
        source: "catalog-fallback",
        category: cat,
      });
    }

    // Merge: prepend a couple of catalog items so the UI is never empty
    // even if YouTube is slow, then append unique RSS items.
    const catalogTop = filterCatalog({ category: cat, limit: 4 });
    const seen = new Set(catalogTop.map((v) => v.id));
    const merged = [...catalogTop, ...live.filter((v) => !seen.has(v.id))].slice(0, limit);

    return NextResponse.json({
      videos: merged,
      source: "rss-live",
      category: cat,
    });
  } catch (e: any) {
    // Last-resort: catalog.
    const catalog = filterCatalog({ category: cat, limit });
    return NextResponse.json({
      videos: catalog,
      source: "catalog-fallback",
      category: cat,
      error: e?.message,
    });
  }
}
