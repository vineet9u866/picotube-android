import { NextResponse } from "next/server";
import { getPopularByCategory, hasApiKey } from "@/lib/youtube-api";
import { filterCatalog } from "@/lib/youtube-catalog";
import type { VideoCategory } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const VALID: (VideoCategory | "All")[] = [
  "All", "Music", "Tech", "Gaming", "Science", "Education", "Comedy",
  "Travel", "Cooking", "Sports", "Trailers", "Live", "News",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cat = (url.searchParams.get("category") || "All") as VideoCategory | "All";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "24", 10) || 24, 50);

  if (!VALID.includes(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    // Always include catalog results first so UI is never empty even if the API is rate-limited.
    const catalog = filterCatalog({ category: cat, limit });
    let apiResults: typeof catalog = [];
    if (hasApiKey()) {
      try {
        apiResults = await getPopularByCategory(cat, limit) as typeof catalog;
      } catch {
        apiResults = [];
      }
    }
    // Merge: prefer catalog items, append unique API items.
    const seen = new Set(catalog.map((v) => v.id));
    const merged = [...catalog, ...apiResults.filter((v) => !seen.has(v.id))].slice(0, limit);
    return NextResponse.json({
      videos: merged,
      source: hasApiKey() ? "hybrid" : "catalog",
      category: cat,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
