import { NextResponse } from "next/server";
import { fetchVideoMetadata } from "@/lib/youtube-scraper";
import { fetchAllFeeds } from "@/lib/youtube-rss";
import { findCatalogVideo } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/video/<id>
 *
 * Resolves ANY YouTube video ID to its metadata (including full description).
 * Lookup order:
 *   1. YouTube watch page scrape (full YouTube access — works for any video,
 *      returns title/channel/duration/views/description/thumbnail)
 *   2. Live RSS cache (videos surfaced on home/search — no description)
 *   3. Curated catalog (no description)
 *
 * This means the user can paste any YouTube video ID into the URL and the
 * watch page will load it: #/watch?v=<anyYouTubeVideoId>
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  // 1. YouTube watch page scrape — gives full metadata incl. description.
  try {
    const v = await fetchVideoMetadata(id);
    if (v && v.title !== "YouTube video") {
      return NextResponse.json({ video: v, source: "youtube-scrape" });
    }
  } catch {
    // ignore — fall back
  }

  // 2. Catalog (instant, no description).
  const cached = findCatalogVideo(id);
  if (cached) {
    return NextResponse.json({ video: cached, source: "catalog" });
  }

  // 3. Live RSS cache.
  try {
    const all = await fetchAllFeeds({ category: "All", limit: undefined });
    const hit = all.find((v) => v.id === id);
    if (hit) {
      return NextResponse.json({ video: hit, source: "rss-live" });
    }
  } catch {
    // ignore
  }

  // 4. Last resort: minimal object so the player can still load.
  // The YouTube iframe embed works even without metadata — we just can't
  // show title/channel info. Better than a 404.
  return NextResponse.json({
    video: {
      id,
      title: "YouTube video",
      channel: "Unknown",
      category: "Tech",
    },
    source: "minimal",
  });
}
