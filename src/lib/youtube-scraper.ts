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
  description?: string;
}

export interface ScrapedComment {
  id: string;
  author: string;
  text: string;
  likes?: string;
  published?: string;
  avatar?: string;
  replies?: number;
}

export interface CommentsResult {
  comments: ScrapedComment[];
  nextPageToken?: string;
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
 *   - compactVideoRenderer   → watch page related sidebar (older layout)
 *   - gridVideoRenderer      → older channel /videos pages, trending
 *   - richItemRenderer       → newer channel /videos pages (wraps lockupViewModel)
 *   - lockupViewModel        → newer watch page related sidebar (bare, not
 *                              wrapped in richItemRenderer)
 *
 * For lockupViewModel we normalize to a shape that parseVideoRenderer
 * understands (see normalizeLockupViewModel).
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
  if (obj.richItemRenderer?.content?.lockupViewModel) {
    const normalized = normalizeLockupViewModel(obj.richItemRenderer.content.lockupViewModel);
    if (normalized) acc.push(normalized);
  }
  // On the watch page, lockupViewModel appears bare (no richItemRenderer wrapper).
  // We detect this by checking for a top-level contentId that looks like a
  // video ID (11-char base64) plus a contentImage — the video lockup signature.
  if (obj.lockupViewModel?.contentId && obj.lockupViewModel.contentImage?.thumbnailViewModel) {
    const normalized = normalizeLockupViewModel(obj.lockupViewModel);
    if (normalized) acc.push(normalized);
  }
  for (const v of Object.values(obj)) findVideoRenderers(v, acc);
  return acc;
}

/**
 * Convert a `lockupViewModel` (newer YouTube channel / watch page format)
 * into a shape that `parseVideoRenderer` understands.
 *
 * YouTube has two slightly different layouts:
 *   1. Channel /videos page: `lockupMetadataViewModel.metadataRows[]`
 *   2. Watch page related:    `lockupMetadataViewModel.metadata
 *                              .contentMetadataViewModel.metadataRows[]`
 * We check both.
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

    const meta = lvm.metadata?.lockupMetadataViewModel || {};
    const title = meta.title?.content;
    // Two possible paths for metadataRows (see comment above).
    const rows: any[] =
      meta.metadata?.contentMetadataViewModel?.metadataRows ||
      meta.metadataRows ||
      [];

    let channel = "";
    let views = "";
    let uploaded = "";

    if (rows.length > 0) {
      // Row 0 is usually just the channel name.
      const row0 = rows[0]?.metadataParts || [];
      if (row0[0]?.text?.content) channel = row0[0].text.content;

      // Row 1 typically has views + uploaded (sometimes only one of them).
      const row1 = rows[1]?.metadataParts || [];
      for (const cp of row1) {
        const txt = cp.text?.content;
        const a11y = cp.accessibilityLabel || "";
        if (!txt) continue;
        // Detect views — either an explicit accessibility label like
        // "27 thousand views" or a leading PLAY_ARROW icon.
        if (!views && (/views/i.test(a11y) || cp.leadingIcon?.name === "PLAY_ARROW_OUTLINED")) {
          views = txt;
        } else if (!uploaded && (/ago|streamed|premiered|broadcast/i.test(txt) || /ago|streamed|premiered|broadcast/i.test(a11y))) {
          uploaded = txt;
        }
      }
      // Fallbacks: scan all rows for views/uploaded if not found yet.
      if (!views || !uploaded) {
        for (const row of rows) {
          for (const cp of row.metadataParts || []) {
            const txt = cp.text?.content;
            const a11y = cp.accessibilityLabel || "";
            if (!txt) continue;
            if (!views && /views/i.test(a11y)) views = txt;
            if (!uploaded && /ago|streamed|premiered|broadcast/i.test(a11y)) uploaded = txt;
          }
        }
      }
    }

    const channelId =
      lvm.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
      meta.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId;

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
 *
 * Pagination: `page` is 1-indexed. YouTube's web search URL accepts a `&page=N`
 * query param that returns a different slice of results for the same query.
 */
export async function searchYouTube(
  query: string,
  opts: { limit?: number; category?: VideoCategory | "All"; signal?: AbortSignal; page?: number } = {},
): Promise<ScrapedVideo[]> {
  const limit = Math.min(opts.limit ?? 30, 50);
  const page = Math.max(1, opts.page ?? 1);
  const trimmed = query.trim();
  if (!trimmed) return [];

  let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
  if (page > 1) url += `&page=${page}`;
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
    description: details.shortDescription || "",
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

/**
 * Fetch related videos for a given video by scraping its watch page.
 * YouTube's watch page embeds `ytInitialData` which contains a list of
 * `compactVideoRenderer` items in the "Related" sidebar. These are the
 * videos YouTube itself recommends — much better than guessing via search.
 *
 * Returns up to `limit` related videos.
 */
export async function fetchRelatedVideos(
  videoId: string,
  limit = 20,
): Promise<ScrapedVideo[]> {
  if (!videoId) return [];
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const data = await fetchYtInitialData(url);
  if (!data) return [];

  const renderers = findVideoRenderers(data);
  const seen = new Set<string>([videoId]);
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
 * Fetch the next page of related videos using YouTube's InnerTube API.
 * Takes a continuation token from a previous related-videos call and returns
 * more related videos plus (optionally) another continuation token.
 */
export async function fetchRelatedVideosContinuation(
  continuationToken: string,
  limit = 20,
): Promise<{ videos: ScrapedVideo[]; nextToken?: string }> {
  if (!continuationToken) return { videos: [], nextToken: undefined };
  const response = await callInnertube("next", {
    continuation: continuationToken,
    context: INNERTUBE_CONTEXT,
  });
  if (!response) return { videos: [], nextToken: undefined };

  // Walk the response for any video renderers.
  const renderers = findVideoRenderers(response);
  const out: ScrapedVideo[] = [];
  const seen = new Set<string>();
  for (const vr of renderers) {
    const v = parseVideoRenderer(vr);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
    if (out.length >= limit) break;
  }
  // Look for another continuation token.
  const nextToken = findContinuationToken(response);
  return { videos: out, nextToken };
}

/**
 * Find the first continuationItemRenderer's token in a JSON tree.
 * Used for both comments and related-videos pagination.
 */
function findContinuationToken(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const t = findContinuationToken(v);
      if (t) return t;
    }
    return undefined;
  }
  // Direct hit
  const cir = obj.continuationItemRenderer;
  if (cir) {
    const token =
      cir.continuationEndpoint?.continuationCommand?.token ||
      cir.button?.buttonRenderer?.command?.continuationCommand?.token ||
      cir.continuationCommand?.token;
    if (token) return token;
  }
  // Recurse
  for (const v of Object.values(obj)) {
    const t = findContinuationToken(v);
    if (t) return t;
  }
  return undefined;
}

/** InnerTube API context (the same payload YouTube's web client sends). */
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    hl: "en",
    gl: "US",
  },
};

/** InnerTube API key (public, embedded in YouTube's web client JS). */
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

/** Call a YouTube InnerTube endpoint. Returns parsed JSON or null. */
async function callInnertube(
  endpoint: "next" | "search",
  body: Record<string, unknown>,
): Promise<any | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_KEY}`,
      {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch top-level comments for a YouTube video.
 *
 * Strategy:
 *  1. Scrape the watch page to find the comments-section continuation token
 *     embedded in `ytInitialData`.
 *  2. Call the InnerTube `/next` endpoint with that token to get the actual
 *     comments (YouTube loads comments lazily via this API).
 *
 * Returns up to ~20 comments plus an optional `nextPageToken` for pagination.
 */
export async function fetchVideoComments(
  videoId: string,
  opts: { limit?: number; continuationToken?: string } = {},
): Promise<CommentsResult> {
  const limit = Math.min(opts.limit ?? 20, 50);

  // If a continuation token was supplied, fetch the next page directly.
  let token = opts.continuationToken;
  if (!token) {
    // Otherwise, scrape the watch page to find the comments-section token.
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const data = await fetchYtInitialData(url);
    if (!data) return { comments: [] };
    token = findCommentsToken(data);
    if (!token) return { comments: [] };
  }

  const response = await callInnertube("next", {
    continuation: token,
    context: INNERTUBE_CONTEXT,
  });
  if (!response) return { comments: [] };

  const comments = parseComments(response, limit);
  const nextPageToken = findContinuationToken(response);
  return { comments, nextPageToken };
}

/** Find the comments-section continuation token in ytInitialData. */
function findCommentsToken(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;

  // Look for itemSectionRenderer with sectionIdentifier "comment-item-section"
  // — that's where YouTube puts the comments continuation token.
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const t = findCommentsToken(v);
      if (t) return t;
    }
    return undefined;
  }
  if (obj.itemSectionRenderer?.sectionIdentifier === "comment-item-section") {
    const token = findContinuationToken(obj.itemSectionRenderer);
    if (token) return token;
  }
  for (const v of Object.values(obj)) {
    const t = findCommentsToken(v);
    if (t) return t;
  }
  return undefined;
}

/** Parse comments out of an InnerTube response.
 *
 * Modern YouTube (2024+) uses an entity-batch pattern: the actual comment
 * data lives in `frameworkUpdates.entityBatchUpdate.mutations[].payload
 * .commentEntityPayload`, while the `commentThreadRenderer` items only hold
 * a `commentKey` that references the entity payload by its `key`.
 *
 * We collect all `commentEntityPayload` objects (each one has commentId,
 * content, author, likes, etc.) — preserving their array order, which
 * matches display order.
 */
function parseComments(response: any, limit: number): ScrapedComment[] {
  const out: ScrapedComment[] = [];
  const seen = new Set<string>();

  // 1. Try the modern entity-batch format first.
  const mutations =
    response?.frameworkUpdates?.entityBatchUpdate?.mutations ?? [];
  for (const m of mutations) {
    const cep = m?.payload?.commentEntityPayload;
    if (!cep) continue;
    const c = parseCommentEntity(cep);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
    if (out.length >= limit) break;
  }
  if (out.length > 0) return out;

  // 2. Fall back to legacy commentThreadRenderer walk (older YouTube layout).
  function walk(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const v of obj) walk(v);
      return;
    }
    if (obj.commentThreadRenderer) {
      const c = parseOneComment(obj.commentThreadRenderer);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
      return;
    }
    for (const v of Object.values(obj)) walk(v);
  }
  walk(response);
  return out.slice(0, limit);
}

/** Parse a `commentEntityPayload` (modern YouTube format). */
function parseCommentEntity(cep: any): ScrapedComment | null {
  try {
    const id = cep.properties?.commentId;
    if (!id) return null;
    // content can be { content: "..." } or { runs: [...] } — handle both.
    const contentField = cep.properties?.content;
    let text = "";
    if (typeof contentField === "string") text = contentField;
    else if (contentField?.content) text = contentField.content;
    else if (contentField?.runs) {
      text = contentField.runs.map((r: any) => r?.text || "").join("");
    }
    const author = cep.author?.displayName || "Anonymous";
    const avatar = cep.author?.avatarThumbnailUrl;
    const likes = cep.toolbar?.likeCountNotliked || undefined;
    const published = cep.properties?.publishedTime || undefined;
    const replies = cep.toolbar?.replyCount
      ? parseInt(cep.toolbar.replyCount, 10)
      : undefined;
    return { id, author, text, likes, published, avatar, replies };
  } catch {
    return null;
  }
}

function parseOneComment(ctr: any): ScrapedComment | null {
  try {
    const c = ctr.comment?.commentRenderer || ctr.comment;
    if (!c) return null;
    const id = c.commentId;
    if (!id) return null;
    const author = getText(c.authorText) || "Anonymous";
    const text = getText(c.contentText) || "";
    const likes = getText(c.voteCount) || undefined;
    const published = getText(c.publishedTimeText) || undefined;
    const avatar = c.authorThumbnail?.thumbnails?.slice(-1)[0]?.url;
    const replies = ctr.comment?.commentRenderer?.replyCount
      ? ctr.comment.commentRenderer.replyCount
      : undefined;
    return { id, author, text, likes, published, avatar, replies };
  } catch {
    return null;
  }
}

function parseOneCommentEntity(cep: any): ScrapedComment | null {
  try {
    const id = cep.properties?.commentId;
    if (!id) return null;
    const author = getText(cep.author?.name) || "Anonymous";
    const text = getText(cep.properties?.content) || "";
    const likes = getText(cep.toolbar?.likeCountNotliked) || undefined;
    const published = getText(cep.properties?.publishedTime) || undefined;
    const avatar = cep.author?.avatar?.thumbnails?.slice(-1)[0]?.url;
    return { id, author, text, likes, published, avatar };
  } catch {
    return null;
  }
}
