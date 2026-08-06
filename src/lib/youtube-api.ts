/**
 * PicoTube — YouTube Data API v3 wrapper.
 *
 * Used when YOUTUBE_API_KEY is configured. Falls back gracefully to the
 * curated catalog otherwise. All requests are server-side (Next.js route
 * handlers) to keep the API key private.
 */

import { CATALOG, type CatalogVideo, type VideoCategory, filterCatalog, findCatalogVideo } from "./youtube-catalog";

const YT_API = "https://www.googleapis.com/youtube/v3";

export function hasApiKey(): boolean {
  const k = process.env.YOUTUBE_API_KEY;
  return !!k && k.length > 5;
}

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY is not set");
  return k;
}

/** Map a free-text category to a YouTube videoCategoryId (US region). */
const CATEGORY_ID_MAP: Record<string, string> = {
  Music: "10",
  Sports: "17",
  Gaming: "20",
  Comedy: "23",
  News: "25",
  Trailers: "44", // Trailers / Reviews (broad match)
  Education: "27",
  Science: "28",
  Tech: "28", // Science & Technology
  Travel: "19", // Travel & Events
  Cooking: "26", // Howto & Style
  Live: "24", // Entertainment
};

interface ApiVideo {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  category: VideoCategory;
  duration?: string;
  views?: string;
  uploaded?: string;
}

function parseIsoDuration(iso: string): string {
  // ISO 8601 duration: PT#H#M#S
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const s = m[3] ? parseInt(m[3], 10) : 0;
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

function formatViews(count: string): string {
  const n = parseInt(count, 10);
  if (isNaN(n)) return count;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function categoryFromApi(videoCategoryId?: string): VideoCategory {
  const reverse: Record<string, VideoCategory> = {};
  for (const [k, v] of Object.entries(CATEGORY_ID_MAP)) {
    if (!reverse[v]) reverse[v] = k as VideoCategory;
  }
  return (videoCategoryId && reverse[videoCategoryId]) || "Tech";
}

/** Search YouTube via the Data API v3. */
export async function searchYouTube(query: string, opts: { maxResults?: number; category?: VideoCategory } = {}): Promise<ApiVideo[]> {
  const maxResults = Math.min(opts.maxResults ?? 24, 50);
  const url = new URL(`${YT_API}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("regionCode", "US");
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("key", apiKey());

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`YouTube search failed: ${res.status}`);
  }
  const data = await res.json();
  const ids = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  // Fetch full video details for duration/views/category
  const details = await fetchVideoDetails(ids);
  const detailMap = new Map(details.map((d) => [d.id, d]));

  return (data.items || [])
    .map((i: any) => {
      const id = i.id?.videoId;
      if (!id) return null;
      const d = detailMap.get(id);
      return {
        id,
        title: i.snippet?.title ?? "",
        channel: i.snippet?.channelTitle ?? "",
        channelId: i.snippet?.channelId,
        category: d?.category ?? "Tech",
        duration: d?.duration,
        views: d?.views,
        uploaded: i.snippet?.publishedAt?.slice(0, 10),
      } as ApiVideo;
    })
    .filter(Boolean) as ApiVideo[];
}

/** Fetch video details (duration, views, category) via videos.list endpoint. */
async function fetchVideoDetails(ids: string[]): Promise<Array<{ id: string; duration?: string; views?: string; category: VideoCategory }>> {
  const url = new URL(`${YT_API}/videos`);
  url.searchParams.set("part", "contentDetails,statistics,snippet");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("key", apiKey());
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((v: any) => ({
    id: v.id,
    duration: v.contentDetails?.duration ? parseIsoDuration(v.contentDetails.duration) : undefined,
    views: v.statistics?.viewCount ? formatViews(v.statistics.viewCount) : undefined,
    category: categoryFromApi(v.snippet?.categoryId),
  }));
}

/** Get popular videos by category. Falls back to catalog if no API key. */
export async function getPopularByCategory(category: VideoCategory | "All", limit = 24): Promise<ApiVideo[]> {
  if (!hasApiKey()) {
    return filterCatalog({ category, limit }) as unknown as ApiVideo[];
  }
  if (category === "All") {
    // No category filter — pull catalog so the user always has results even if API is rate-limited
    return filterCatalog({ category: "All", limit }) as unknown as ApiVideo[];
  }
  try {
    const catId = CATEGORY_ID_MAP[category];
    if (!catId) {
      return filterCatalog({ category, limit }) as unknown as ApiVideo[];
    }
    const url = new URL(`${YT_API}/videos`);
    url.searchParams.set("part", "snippet,contentDetails,statistics");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("videoCategoryId", catId);
    url.searchParams.set("regionCode", "US");
    url.searchParams.set("maxResults", String(Math.min(limit, 50)));
    url.searchParams.set("key", apiKey());
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`popular failed: ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((v: any) => ({
      id: v.id,
      title: v.snippet?.title ?? "",
      channel: v.snippet?.channelTitle ?? "",
      channelId: v.snippet?.channelId,
      category,
      duration: v.contentDetails?.duration ? parseIsoDuration(v.contentDetails.duration) : undefined,
      views: v.statistics?.viewCount ? formatViews(v.statistics.viewCount) : undefined,
      uploaded: v.snippet?.publishedAt?.slice(0, 10),
    })) as ApiVideo[];
  } catch {
    return filterCatalog({ category, limit }) as unknown as ApiVideo[];
  }
}

/** Get a single video's metadata. Always returns catalog version if present. */
export async function getVideo(id: string): Promise<ApiVideo | null> {
  const cached = findCatalogVideo(id);
  if (cached) return cached as unknown as ApiVideo;
  if (!hasApiKey()) return null;
  try {
    const details = await fetchVideoDetails([id]);
    if (!details.length) return null;
    const d = details[0];
    // Fetch snippet for title / channel
    const url = new URL(`${YT_API}/videos`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", id);
    url.searchParams.set("key", apiKey());
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const v = data.items?.[0];
    if (!v) return null;
    return {
      id,
      title: v.snippet?.title ?? "",
      channel: v.snippet?.channelTitle ?? "",
      channelId: v.snippet?.channelId,
      category: d.category,
      duration: d.duration,
      views: d.views,
      uploaded: v.snippet?.publishedAt?.slice(0, 10),
    };
  } catch {
    return null;
  }
}

/** Search that gracefully falls back to catalog filter when no API key is set. */
export async function searchOrFilter(query: string, opts: { category?: VideoCategory | "All"; limit?: number } = {}): Promise<ApiVideo[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return getPopularByCategory(opts.category ?? "All", opts.limit ?? 24);
  }
  if (!hasApiKey()) {
    return filterCatalog({ query: trimmed, category: opts.category ?? "All", limit: opts.limit }) as unknown as ApiVideo[];
  }
  try {
    const remote = await searchYouTube(trimmed, { maxResults: opts.limit ?? 24, category: opts.category === "All" ? undefined : opts.category });
    if (remote.length > 0) return remote;
    return filterCatalog({ query: trimmed, category: opts.category ?? "All", limit: opts.limit }) as unknown as ApiVideo[];
  } catch {
    return filterCatalog({ query: trimmed, category: opts.category ?? "All", limit: opts.limit }) as unknown as ApiVideo[];
  }
}

/** Curated catalog (used for first paint / loading state). */
export function getCatalog(): CatalogVideo[] {
  return CATALOG;
}
