import { NextResponse } from "next/server";
import { fetchChannelVideos } from "@/lib/youtube-scraper";

export const dynamic = "force-dynamic";
export const revalidate = 600;

/**
 * GET /api/channel-videos/<channelIdOrHandle>?limit=<n>
 *
 * Fetches the latest uploads from ANY YouTube channel by channel ID (UC...)
 * or @handle. Full YouTube access — no API key.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing channel id" }, { status: 400 });
  }

  const url = new URL(_req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50);

  try {
    const videos = await fetchChannelVideos(id, limit);
    return NextResponse.json({
      videos,
      channel: id,
      source: "youtube-scrape",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to fetch channel videos" },
      { status: 500 },
    );
  }
}
