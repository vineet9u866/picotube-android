import { NextResponse } from "next/server";
import { searchFeeds } from "@/lib/youtube-rss";
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
  const query = url.searchParams.get("q") || "";
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 60);

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    // Primary: live RSS search across all channels.
    const live = await searchFeeds(query, { category: cat, limit });

    // Fallback: catalog filter (always returns something for common terms).
    const catalog = filterCatalog({ query, category: cat, limit });

    if (live.length === 0 && catalog.length === 0) {
      return NextResponse.json({
        videos: [],
        source: "empty",
        query,
        category: cat,
      });
    }

    // Merge: prefer live results, supplement with catalog.
    const seen = new Set(live.map((v) => v.id));
    const merged = [...live, ...catalog.filter((v) => !seen.has(v.id))].slice(0, limit);

    return NextResponse.json({
      videos: merged,
      source: live.length > 0 ? "rss-live" : "catalog-fallback",
      query,
      category: cat,
    });
  } catch (e: any) {
    const catalog = filterCatalog({ query, category: cat, limit });
    return NextResponse.json({
      videos: catalog,
      source: "catalog-fallback",
      query,
      category: cat,
      error: e?.message,
    });
  }
}
