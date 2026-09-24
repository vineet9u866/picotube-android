import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/download
 *   body: { url: "https://youtube.com/watch?v=...", quality: "480p" | "720p" | "1080p" }
 *
 * Resolves a YouTube video to a direct stream URL by delegating to a
 * Cobalt-compatible API instance. The Cobalt API (https://github.com/imputnet/cobalt)
 * extracts a direct .mp4 URL server-side and returns it as a redirect.
 *
 * We just proxy the request — the actual file is delivered directly to the
 * user's device, never through our server. This keeps us out of the
 * bandwidth / DMCA path; we only resolve the URL.
 *
 * Configuration: set COBALT_API_URL in your environment to point at a
 * self-hosted Cobalt instance. Defaults to the public instance. The user
 * should host their own Cobalt for production use.
 *
 * Quality mapping:
 *   480p → 480
 *   720p → 720
 *   1080p → 1080
 */
const COBALT_API_URL =
  process.env.COABLT_API_URL ||
  process.env.COBAKT_API_URL ||
  process.env.COBAKT_API_URL ||
  "https://api.cobalt.tools";

const QUALITY_MAP: Record<string, string> = {
  "144p": "144",
  "240p": "240",
  "360p": "360",
  "480p": "480",
  "720p": "720",
  "1080p": "1080",
  "1440p": "1440",
  "2160p": "2160",
};

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const quality = QUALITY_MAP[body?.quality] || "720";

  if (!url || !/^https?:\/\/(www\.)?youtube\.com\/watch\?v=|^https?:\/\/youtu\.be\//.test(url)) {
    return NextResponse.json(
      { status: "error", error: "Invalid YouTube URL" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${COBALT_API_URL}/api/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        // Cobalt requires a User-Agent.
        "User-Agent": "PicoTube/1.0 (+https://picotube.app)",
      },
      body: JSON.stringify({
        url,
        vQuality: quality,
        vCodec: "h264",
        aFormat: "mp3",
        isAudioOnly: false,
        isNoTTwatermark: true,
      }),
      // Don't cache — URLs are usually single-use and time-limited.
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", error: `Cobalt responded with HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", error: e?.message || "Download service unavailable" },
      { status: 502 },
    );
  }
}
