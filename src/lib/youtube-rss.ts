/**
 * PicoTube — YouTube RSS feed fetcher.
 *
 * YouTube exposes a free, no-auth RSS feed for every channel:
 *   https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
 *
 * The feed returns the most recent ~15 uploads from that channel in Atom XML
 * format. We fetch them server-side (so the user's browser never needs an API
 * key) and parse the XML into structured video objects.
 *
 * Caching: 10-minute in-memory cache per channel + a short-circuit if a feed
 * fails (so one bad channel doesn't slow the whole app).
 */

import { CHANNELS_FINAL, type ChannelSeed } from "./youtube-channels";
import type { VideoCategory } from "./youtube-catalog";

const FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

export interface RssVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  category: VideoCategory;
  uploaded: string; // ISO date
  duration?: string;
  views?: string;
}

interface CacheEntry {
  at: number;
  videos: RssVideo[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const channelCache = new Map<string, CacheEntry>();
const failureCache = new Map<string, number>(); // channelId → next-allowed-time
const FAILURE_BACKOFF_MS = 2 * 60 * 1000; // skip failed feeds for 2 minutes

/** Parse ISO 8601 duration (PT#H#M#S) → "H:MM:SS" or "M:SS". */
function parseIsoDuration(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const s = m[3] ? parseInt(m[3], 10) : 0;
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

function formatViews(count: string | null | undefined): string | undefined {
  if (!count) return undefined;
  const n = parseInt(count, 10);
  if (isNaN(n)) return undefined;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Parse a YouTube Atom RSS feed XML string into structured video objects.
 * YouTube's feed includes the MediaRSS extension which gives us duration
 * and view count for free.
 */
function parseFeed(xml: string, seed: ChannelSeed): RssVideo[] {
  const videos: RssVideo[] = [];

  // We avoid a DOM parser dependency by using regex on the well-structured
  // YouTube Atom feed. Each <entry> contains the fields we need.
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRe.exec(xml)) !== null) {
    const entry = entryMatch[1];

    // Video ID — YouTube uses yt:videoId
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!idMatch) continue;
    const id = idMatch[1].trim();

    // Title
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Published date — take date portion only
    const pubMatch = entry.match(/<published>([^<]+)<\/published>/);
    const published = pubMatch ? pubMatch[1].slice(0, 10) : "";

    // Channel name — yt:channelName or author/name
    const channelNameMatch = entry.match(/<yt:channelName>([^<]+)<\/yt:channelName>/);
    const authorMatch = entry.match(/<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/);
    const channel = (channelNameMatch?.[1] || authorMatch?.[1] || seed.handle).trim();

    // Duration from media:content or yt:duration — MediaRSS extension
    let duration: string | undefined;
    const durMatch1 = entry.match(/<media:content[^>]*duration="(\d+)"[^>]*>/);
    const durMatch2 = entry.match(/<yt:duration>(\d+)<\/yt:duration>/);
    const durSeconds = durMatch1 ? parseInt(durMatch1[1], 10) : durMatch2 ? parseInt(durMatch2[1], 10) : null;
    if (durSeconds !== null && !isNaN(durSeconds)) {
      const h = Math.floor(durSeconds / 3600);
      const m = Math.floor((durSeconds % 3600) / 60);
      const s = durSeconds % 60;
      if (h > 0) duration = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      else duration = `${m}:${String(s).padStart(2, "0")}`;
    }

    // Views from media:community statistics
    let views: string | undefined;
    const viewsMatch = entry.match(/<media:statistics[^>]*views="(\d+)"/);
    if (viewsMatch) views = formatViews(viewsMatch[1]);

    videos.push({
      id,
      title,
      channel,
      channelId: seed.channelId,
      category: seed.category,
      uploaded: published,
      duration,
      views,
    });
  }

  return videos;
}

async function fetchOne(seed: ChannelSeed, signal?: AbortSignal): Promise<RssVideo[]> {
  // Cache hit?
  const cached = channelCache.get(seed.channelId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.videos;
  }

  // Failure backoff?
  const failAt = failureCache.get(seed.channelId);
  if (failAt && Date.now() < failAt) {
    return [];
  }

  try {
    const res = await fetch(FEED_URL(seed.channelId), {
      signal,
      headers: {
        // YouTube returns the same XML regardless, but a UA helps with some caches.
        "User-Agent": "PicoTube/1.0 (+https://picotube.app)",
        "Accept": "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const xml = await res.text();
    const videos = parseFeed(xml, seed);
    channelCache.set(seed.channelId, { at: Date.now(), videos });
    failureCache.delete(seed.channelId);
    return videos;
  } catch (err) {
    failureCache.set(seed.channelId, Date.now() + FAILURE_BACKOFF_MS);
    // Return any stale cache we might have rather than nothing.
    const stale = channelCache.get(seed.channelId);
    return stale?.videos ?? [];
  }
}

/** Fetch videos from all channels in parallel. Returns flattened, deduplicated. */
export async function fetchAllFeeds(opts?: { category?: VideoCategory | "All"; limit?: number; signal?: AbortSignal }): Promise<RssVideo[]> {
  const { category = "All", limit, signal } = opts || {};
  const seeds = category === "All"
    ? CHANNELS_FINAL
    : CHANNELS_FINAL.filter((c) => c.category === category);

  const results = await Promise.allSettled(seeds.map((s) => fetchOne(s, signal)));
  const seen = new Set<string>();
  const merged: RssVideo[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const v of r.value) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      merged.push(v);
    }
  }
  // Sort by upload date descending (newest first).
  merged.sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || ""));
  if (limit && merged.length > limit) return merged.slice(0, limit);
  return merged;
}

/** Search across all RSS-fetched videos by title / channel name. */
export async function searchFeeds(query: string, opts?: { category?: VideoCategory | "All"; limit?: number; signal?: AbortSignal }): Promise<RssVideo[]> {
  const q = query.trim().toLowerCase();
  if (!q) return fetchAllFeeds(opts);
  const all = await fetchAllFeeds({ category: opts?.category || "All", limit: undefined, signal: opts?.signal });
  return all
    .filter((v) =>
      v.title.toLowerCase().includes(q) ||
      v.channel.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q),
    )
    .slice(0, opts?.limit ?? 50);
}

/** Fetch a single channel's feed by channelId (used by the channel browse view). */
export async function fetchChannelFeed(channelId: string, category: VideoCategory = "Tech"): Promise<RssVideo[]> {
  const seed: ChannelSeed = { channelId, handle: channelId, category };
  return fetchOne(seed);
}

/** Returns the list of seeded channels (for the sidebar / browse page). */
export function listSeededChannels(): ChannelSeed[] {
  return CHANNELS_FINAL;
}
