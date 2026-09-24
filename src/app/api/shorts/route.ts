import { NextResponse } from "next/server";
import { fetchShorts } from "@/lib/youtube-scraper";

export const dynamic = "force-dynamic";
export const revalidate = 600;

/**
 * GET /api/shorts?page=<n>&limit=<n>
 *
 * Returns a feed of YouTube Shorts — vertical, sub-60s videos scraped from
 * YouTube's trending-shorts shelf. The Shorts view renders them in a
 * TikTok-style vertical snap pager.
 *
 * Pagination: `page` is 1-indexed. Page 1 returns trending shorts;
 * pages 2+ fall through to "#shorts" search with the page param for variety.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 50);

  try {
    const shorts = await fetchShorts({ limit, page });
    return NextResponse.json({
      videos: shorts,
      source: "youtube-shorts",
      page,
      hasMore: shorts.length >= limit,
    });
  } catch (e: any) {
    return NextResponse.json({
      videos: [],
      source: "youtube-shorts",
      page,
      hasMore: false,
      error: e?.message,
    });
  }
}
