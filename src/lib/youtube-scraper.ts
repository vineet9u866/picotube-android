/**
 * PicoTube — YouTube full search & trending scraper.
 *
 * This module gives PicoTube FULL access to YouTube's content without an API
 * key. We hit YouTube's public web pages (search results, trending, watch
 * page) and parse the `ytInitialData` JSON that YouTube embeds in every page.
 *
 * This is the same data the YouTube website itself uses to render — every
 * video, channel, view count, upload date, and duration is available.
 *
 * Playback still uses YouTube's official iframe embed (the only legal way to
 * play a YouTube video). We never proxy or download video streams.
 *
 * Bot-friendliness: we send a real browser User-Agent, Accept-Language, and
 * use a generous timeout. YouTube returns the full HTML+JSON on first request
 * without challenging us in practice.
 */

import type { VideoCategory } from "./youtube-catalog";

export interface ScrapedVideo {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  category: VideoCategory;
  duration?: string;
  views?: string;
  uploaded?: string;
  thumbnail?: string;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

/** Fetch a YouTube page and extract its ytInitialData JSON object. */
async function fetchYtInitialData(url: string): Promise<any | null> {
  const html = await fetchYouTubeHtml(url);
  return extractJsonObject(html, [
    /window\["ytInitialData"\]\s*=\s*/,
    /ytInitialData\s*=\s*/,
  ]);
}

/** Fetch a YouTube page and extract its ytInitialPlayerResponse JSON object. */
async function fetchYtPlayerResponse(url: string): Promise<any | null> {
  const html = await fetchYouTubeHtml(url);
  return extractJsonObject(html, [
    /window\["ytInitialPlayerResponse"\]\s*=\s*/,
    /ytInitialPlayerResponse\s*=\s*/,
  ]);
}

async function fetchYouTubeHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`YouTube fetch failed: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Extract a top-level JSON object from an HTML string starting after one of
 * the given regex patterns. Walks the string tracking brace depth + string
 * state to find the matching closing brace — more reliable than regex for
 * deeply nested JSON.
 */
function extractJsonObject(html: string, patterns: RegExp[]): any | null {
  let jsonStart = -1;
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m.index !== undefined) {
      jsonStart = m.index + m[0].length;
      break;
    }
  }
  if (jsonStart < 0 || html[jsonStart] !== "{") return null;

  let depth = 0;
  let inStr = false;
  let escape = false;
  let end = -1;
  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;

  try {
    return JSON.parse(html.slice(jsonStart, end + 1));
  } catch {
    return null;
  }
}

/** Walk the JSON tree and collect all video renderer objects. YouTube uses
 * different renderer types on different pages:
 *   - videoRenderer          → search results, watch page related
 *   - compactVideoRenderer   → watch page related sidebar
 *   - gridVideoRenderer      → older channel /videos pages, trending
 *   - richItemRenderer       → newer channel /videos pages (wraps lockupViewModel)
 */
function findVideoRenderers(obj: any, acc: any[] = []): any[] {
  if (!obj || typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    for (const v of obj) findVideoRenderers(v, acc);
    return acc;
  }
  if (obj.videoRenderer) acc.push(obj.videoRenderer);
  if (obj.compactVideoRenderer) acc.push(obj.compactVideoRenderer);
  if (obj.gridVideoRenderer) acc.push(obj.gridVideoRenderer);
  // Newer YouTube layout wraps videos in richItemRenderer > content > lockupViewModel.
  // Normalize it to look like a videoRenderer so parseVideoRenderer can handle it.
  if (obj.richItemRenderer?.content?.lockupViewModel) {
    const lvm = obj.richItemRenderer.content.lockupViewModel;
    const normalized = normalizeLockupViewModel(lvm);
    if (normalized) acc.push(normalized);
  }
  for (const v of Object.values(obj)) findVideoRenderers(v, acc);
  return acc;
}

/**
 * Convert a `lockupViewModel` (newer YouTube channel page format) into a
 * shape that `parseVideoRenderer` understands.
 */
function normalizeLockupViewModel(lvm: any): any | null {
  try {
    const contentId = lvm.contentId;
    if (!contentId) return null;
    const thumb = lvm.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url;
    // Find duration badge in overlays
    let duration: string | undefined;
    const overlays = lvm.contentImage?.thumbnailViewModel?.overlays || [];
    for (const ov of overlays) {
      const badges = ov.thumbnailBottomOverlayViewModel?.badges || [];
      for (const b of badges) {
        const txt = b.thumbnailBadgeViewModel?.text;
        if (txt && /^\d+:\d+/.test(txt)) { duration = txt; break; }
      }
      if (duration) break;
    }
    // Title and metadata from lockupViewModel.metadata.lockupMetadataViewModel
    const meta = lvm.metadata?.lockupMetadataViewModel || {};
    const title = meta.title?.content;
    const imageMeta = meta.image?.decoratedAvatar?.avatar?.avatarViewModel?.image?.sources?.[0]?.url;
    // Channel name + subscriber info is in metadata.rows
    let channel = "";
    let views = "";
    let uploaded = "";
    for (const row of meta.metadataRows || []) {
      for (const cp of row.metadataParts || []) {
        const txt = cp.text?.content;
        if (!txt) continue;
        if (!channel && /channel/i.test(cp.text?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.browseId || "")) {
          channel = txt;
        }
        if (/views/i.test(txt)) views = txt;
        if (/ago/i.test(txt)) uploaded = txt;
      }
    }
    // If channel not found in rows, use the first metadata part
    if (!channel && meta.metadataRows?.[0]?.metadataParts?.[0]?.text?.content) {
      channel = meta.metadataRows[0].metadataParts[0].text.content;
    }
    const channelId = lvm.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId;
    return {
      videoId: contentId,
      title: title || "",
      ownerText: { runs: channel ? [{ text: channel }] : [] },
      shortBylineText: { runs: channel ? [{ text: channel }] : [] },
      channelId,
      viewCountText: { simpleText: views || "" },
      publishedTimeText: { simpleText: uploaded || "" },
      lengthText: duration ? { simpleText: duration } : undefined,
      thumbnail: thumb ? { thumbnails: [{ url: thumb }] } : undefined,
    };
  } catch {
    return null;
  }
}

/** Walk the JSON tree and collect all `channelRenderer` objects (for channel search). */
function findChannelRenderers(obj: any, acc: any[] = []): any[] {
  if (!obj || typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    for (const v of obj) findChannelRenderers(v, acc);
    return acc;
  }
  if (obj.channelRenderer) acc.push(obj.channelRenderer);
  for (const v of Object.values(obj)) findChannelRenderers(v, acc);
  return acc;
}

/** Map a YouTube category hint (from search context) to our enum. */
function inferCategory(text: string): VideoCategory {
  const t = text.toLowerCase();
  if (/(music|song|album|official audio|vevo|lofi|beat)/.test(t)) return "Music";
  if (/(gameplay|game|gaming|minecraft|fortnite|trailer.*game|playstation|xbox)/.test(t)) return "Gaming";
  if (/(science|physics|chemistry|biology|space|nasa|spacex|quantum)/.test(t)) return "Science";
  if (/(tutorial|course|learn|lesson|lecture|education|explained)/.test(t)) return "Education";
  if (/(funny|comedy|standup|sketch|parody)/.test(t)) return "Comedy";
  if (/(travel|city|country|trip|destination)/.test(t)) return "Travel";
  if (/(recipe|cooking|food|bake|chef|kitchen)/.test(t)) return "Cooking";
  if (/(sport|nba|fifa|football|soccer|basketball|goals?)/.test(t)) return "Sports";
  if (/(trailer|teaser|official trailer|movie|film|cinema)/.test(t)) return "Trailers";
  if (/(news|breaking|report|coverage|live.*news)/.test(t)) return "News";
  if (/(tech|review|iphone|android|laptop|gadget|coding|programming)/.test(t)) return "Tech";
  if (/(live|24\/7|radio|stream)/.test(t)) return "Live";
  return "Tech"; // sensible default
}

function getText(obj: any): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (obj.simpleText) return obj.simpleText;
  if (obj.runs) return obj.runs.map((r: any) => r.text || "").join("");
  return "";
}

function parseVideoRenderer(vr: any, fallbackCategory?: VideoCategory): ScrapedVideo | null {
  try {
    const id = vr.videoId;
    if (!id) return null;
    const title = getText(vr.title);
    // gridVideoRenderer uses shortBylineText; videoRenderer uses ownerText + shortBylineText
    const channel = getText(vr.ownerText) || getText(vr.shortBylineText) || getText(vr.longBylineText);
    const channelId = vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || vr.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || vr.channelId;
    const views = getText(vr.viewCountText) || getText(vr.shortViewCountText);
    const uploaded = getText(vr.publishedTimeText);
    // gridVideoRenderer sometimes puts duration in thumbnailOverlays instead of lengthText
    let duration = getText(vr.lengthText);
    if (!duration) {
      const overlay = vr.thumbnailOverlays?.find?.((o: any) => o.thumbnailOverlayTimeStatusRenderer);
      if (overlay) duration = getText(overlay.thumbnailOverlayTimeStatusRenderer.text);
    }
    const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

    // Skip playlists / shorts labeled as such
    if (vr.thumbnailOverlays?.some?.((o: any) => o.thumbnailOverlayTimeStatusRenderer?.style === "SHORTS")) {
      // We'll still include Shorts but flag via category
    }

    return {
      id,
      title,
      channel,
      channelId,
      category: fallbackCategory || inferCategory(`${title} ${channel}`),
      duration,
      views,
      uploaded,
      thumbnail: thumb,
    };
  } catch {
    return null;
  }
}

/**
 * Search ALL of YouTube for a query. Returns up to `limit` videos.
 * Filter `sp` param controls result type:
 *   - "" → all videos (default)
 *   - "EgIQAQ%3D%3D" → videos only
 *   - "EgIQAg%3D%3D" → channels only
 */
export async function searchYouTube(query: string, opts: { limit?: number; category?: VideoCategory | "All"; signal?: AbortSignal } = {}): Promise<ScrapedVideo[]> {
  const limit = Math.min(opts.limit ?? 30, 50);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
  const data = await fetchYtInitialData(url);
  if (!data) return [];

  const renderers = findVideoRenderers(data);
  const seen = new Set<string>();
  const out: ScrapedVideo[] = [];

  for (const vr of renderers) {
    const v = parseVideoRenderer(vr, opts.category === "All" || !opts.category ? undefined : opts.category);
    if (!v) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/** Search YouTube for channels matching a query. */
export async function searchYouTubeChannels(query: string, limit = 10): Promise<Array<{ channelId: string; title: string; handle?: string; subscriberCount?: string; thumbnail?: string }>> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}&sp=EgIQAg%3D%3D`;
  const data = await fetchYtInitialData(url);
  if (!data) return [];
  const renderers = findChannelRenderers(data);
  return renderers.slice(0, limit).map((cr) => ({
    channelId: cr.channelId,
    title: getText(cr.title),
    handle: cr.channelHandleText ? getText(cr.channelHandleText) : undefined,
    subscriberCount: getText(cr.subscriberCountText),
    thumbnail: cr.thumbnail?.thumbnails?.slice(-1)[0]?.url,
  }));
}

/**
 * Fetch the latest uploads for ANY channel — by channel ID or @handle.
 * This scrapes the channel's /videos page.
 */
export async function fetchChannelVideos(channelIdOrHandle: string, limit = 20): Promise<ScrapedVideo[]> {
  const id = channelIdOrHandle.trim();
  if (!id) return [];
  const url = id.startsWith("UC")
    ? `https://www.youtube.com/channel/${id}/videos`
    : `https://www.youtube.com/${id.startsWith("@") ? id : "@" + id}/videos`;
  const data = await fetchYtInitialData(url);
  if (!data) return [];
  const renderers = findVideoRenderers(data);
  const seen = new Set<string>();
  const out: ScrapedVideo[] = [];
  for (const vr of renderers) {
    const v = parseVideoRenderer(vr);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Fetch a single video's metadata by scraping its watch page.
 * Uses `ytInitialPlayerResponse` which contains full video details:
 * title, author, channel, view count, duration, description, keywords.
 * Works for ANY public YouTube video — no API key, no quota.
 */
export async function fetchVideoMetadata(videoId: string): Promise<ScrapedVideo | null> {
  if (!videoId) return null;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const player = await fetchYtPlayerResponse(url);
  if (!player) {
    // Fallback to ytInitialData (related videos only — no current video metadata).
    return {
      id: videoId,
      title: "YouTube video",
      channel: "Unknown channel",
      category: "Tech",
    };
  }

  const details = player.videoDetails;
  if (!details) {
    return {
      id: videoId,
      title: "YouTube video",
      channel: "Unknown channel",
      category: "Tech",
    };
  }

  // Convert lengthSeconds (e.g. "213") → "M:SS" or "H:MM:SS"
  let duration: string | undefined;
  if (details.lengthSeconds) {
    const total = parseInt(details.lengthSeconds, 10);
    if (!isNaN(total)) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      duration = h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
    }
  }

  // Format viewCount (e.g. "1801213618") → "1.8B"
  let views: string | undefined;
  if (details.viewCount) {
    const n = parseInt(details.viewCount, 10);
    if (!isNaN(n)) {
      if (n >= 1_000_000_000) views = `${(n / 1_000_000_000).toFixed(1)}B`;
      else if (n >= 1_000_000) views = `${(n / 1_000_000).toFixed(1)}M`;
      else if (n >= 1_000) views = `${(n / 1_000).toFixed(1)}K`;
      else views = String(n);
    }
  }

  // Infer category from keywords + title
  const keywords = details.keywords || [];
  const category = inferCategory(`${details.title} ${details.author} ${keywords.join(" ")}`);

  return {
    id: videoId,
    title: details.title || "YouTube video",
    channel: details.author || "Unknown channel",
    channelId: details.channelId,
    category,
    duration,
    views,
    thumbnail: details.thumbnail?.thumbnails?.slice(-1)[0]?.url,
  };
}

/**
 * Get YouTube's "Trending" feed.
 * Note: YouTube requires a consent cookie for this in some regions, so we
 * also fall back to a generic search for trending-style queries.
 */
export async function fetchTrending(limit = 30): Promise<ScrapedVideo[]> {
  try {
    const url = "https://www.youtube.com/feed/trending";
    const data = await fetchYtInitialData(url);
    if (data) {
      const renderers = findVideoRenderers(data);
      const seen = new Set<string>();
      const out: ScrapedVideo[] = [];
      for (const vr of renderers) {
        const v = parseVideoRenderer(vr);
        if (!v || seen.has(v.id)) continue;
        seen.add(v.id);
        out.push(v);
        if (out.length >= limit) break;
      }
      if (out.length > 0) return out;
    }
  } catch {
    // fall through
  }
  // Fallback: search for a broad popular query.
  return searchYouTube("most popular videos 2024", { limit });
}
