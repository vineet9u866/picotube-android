import { NextResponse } from "next/server";
import { fetchVideoComments } from "@/lib/youtube-scraper";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * GET /api/comments/<videoId>?token=<continuationToken>&limit=<n>
 *
 * Fetches comments for ANY public YouTube video using the InnerTube API.
 *
 * Strategy:
 *   1. Scrape the watch page to find the comments-section continuation token
 *      (cached for ~5 min server-side).
 *   2. POST to youtubei/v1/next with that token — YouTube returns the actual
 *      comments (loaded lazily by the official client via the same API).
 *
 * The `token` query param allows fetching subsequent pages.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50);

  try {
    const result = await fetchVideoComments(id, { continuationToken: token, limit });
    return NextResponse.json({
      comments: result.comments,
      nextPageToken: result.nextPageToken,
      hasMore: !!result.nextPageToken,
    });
  } catch (e: any) {
    return NextResponse.json({
      comments: [],
      nextPageToken: undefined,
      hasMore: false,
      error: e?.message,
    });
  }
}
