import { NextResponse } from "next/server";
import { fetchRelatedVideos, fetchRelatedVideosContinuation } from "@/lib/youtube-scraper";

export const dynamic = "force-dynamic";
export const revalidate = 600;

/**
 * GET /api/related/<videoId>?token=<continuationToken>&limit=<n>
 *
 * Fetches YouTube's "related videos" for the given video by scraping the
 * watch page. These are the videos YouTube itself recommends on the watch
 * page sidebar — much better quality than guessing via search.
 *
 * Pagination: pass the `nextToken` from a previous response as `token`
 * to load the next page of related videos.
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
    if (token) {
      // Paginated call via InnerTube continuation.
      const { videos, nextToken } = await fetchRelatedVideosContinuation(token, limit);
      return NextResponse.json({
        videos,
        nextToken,
        hasMore: !!nextToken,
      });
    }

    // First page: scrape the watch page.
    const videos = await fetchRelatedVideos(id, limit);
    return NextResponse.json({
      videos,
      nextToken: undefined,
      hasMore: videos.length >= limit,
    });
  } catch (e: any) {
    return NextResponse.json({
      videos: [],
      nextToken: undefined,
      hasMore: false,
      error: e?.message,
    });
  }
}
