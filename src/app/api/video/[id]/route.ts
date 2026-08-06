import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/youtube-rss";
import { findCatalogVideo } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  // 1. Check the curated catalog first (instant).
  const cached = findCatalogVideo(id);
  if (cached) {
    return NextResponse.json({ video: cached, source: "catalog" });
  }

  // 2. Search the live RSS cache for this video id. This covers all fresh
  //    videos surfaced on the home / search pages.
  try {
    const all = await fetchAllFeeds({ category: "All", limit: undefined });
    const hit = all.find((v) => v.id === id);
    if (hit) {
      return NextResponse.json({ video: hit, source: "rss-live" });
    }
  } catch {
    // ignore — fall through to 404
  }

  return NextResponse.json(
    { error: "Video not found in catalog or live RSS feeds" },
    { status: 404 },
  );
}
