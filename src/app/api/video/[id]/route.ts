import { NextResponse } from "next/server";
import { fetchVideoMetadata } from "@/lib/youtube-scraper";
import { fetchAllFeeds } from "@/lib/youtube-rss";
import { findCatalogVideo } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/video/<id>
 *
 * Resolves ANY YouTube video ID to its metadata (no description, no comments
 * — those have been removed per the PicoTube spec). Lookup order:
 *   1. YouTube watch page scrape (full YouTube access — works for any video,
 *      returns title/channel/duration/views/thumbnail)
 *   2. Live RSS cache (videos surfaced on home/search)
 *   3. Curated catalog
 *
 * This means the user can paste any YouTube video ID into the URL and the
 * watch page will load it: #/watch?v=<anyYouTubeVideoId>
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  // 1. YouTube watch page scrape — gives full metadata.
  try {
    const v = await fetchVideoMetadata(id);
    if (v && v.title !== "YouTube video") {
      // Strip description field if it sneaks in — we never send it to clients.
      const { description: _drop, ...clean } = v as any;
      return NextResponse.json({ video: clean, source: "youtube-scrape" });
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
