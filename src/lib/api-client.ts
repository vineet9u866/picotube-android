/**
 * PicoTube — Runtime detection + API client.
 *
 * The same React frontend runs in two contexts:
 *   1. Web (dev / hosted Next.js) — API routes exist on the same origin.
 *      `/api/catalog`, `/api/search`, etc. are server-side routes that
 *      scrape YouTube directly.
 *   2. Capacitor APK (Android) — the Next.js app is built with
 *      `output: 'export'`, so API routes are stripped. The frontend
 *      has to fetch YouTube data itself, via a CORS proxy (since YouTube
 *      doesn't send CORS headers).
 *
 * This module abstracts the choice. Use `apiClient` from the frontend:
 *
 *   const data = await apiClient.catalog({ category: 'All', page: 1 });
 *   const data = await apiClient.search({ q: 'cats', page: 1 });
 *
 * It routes to /api/* on web and to a CORS-proxied YouTube scrape on
 * Capacitor. The implementations are intentionally identical so the UX
 * is the same.
 */

import type { VideoCategory } from "@/lib/youtube-catalog";

/** True when the code is running inside a Capacitor native shell (Android/iOS). */
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.Capacitor && w.Capacitor.isNative && w.Capacitor.isNative());
}

/** True on the server (Node.js). */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * CORS proxy URL builder. We use `api.allorigins.win` as a primary proxy
 * (free, reliable, supports CORS) and fall back to `corsproxy.io`.
 *
 * The proxy URL is wrapped so YouTube sees a request from the proxy, not
 * from the user's browser — YouTube doesn't send CORS headers so direct
 * fetches from a browser would fail.
 */
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithProxy(targetUrl: string, init?: RequestInit): Promise<Response> {
  // Try each proxy in turn until one works.
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(targetUrl), init);
      if (res.ok) return res;
    } catch {
      // try next
    }
  }
  throw new Error("All CORS proxies failed");
}

async function fetchYtHtmlViaProxy(url: string): Promise<string> {
  const res = await fetchWithProxy(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return res.text();
}

/** Extract a JSON object from an HTML page starting after one of the regexes. */
function extractJson(html: string, patterns: RegExp[]): any | null {
  let start = -1;
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m.index !== undefined) {
      start = m.index + m[0].length;
      break;
    }
  }
  if (start < 0 || html[start] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
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
    return JSON.parse(html.slice(start, end + 1));
  } catch {
    return null;
  }
}

interface ScrapedVideoClient {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  category: VideoCategory;
  duration?: string;
  views?: string;
  uploaded?: string;
  thumbnail?: string;
  isShort?: boolean;
}

function getText(obj: any): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (obj.simpleText) return obj.simpleText;
  if (obj.runs) return obj.runs.map((r: any) => r.text || "").join("");
  return "";
}

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
  return "Tech";
}

function findVideoRenderers(obj: any, acc: any[] = []): any[] {
  if (!obj || typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    for (const v of obj) findVideoRenderers(v, acc);
    return acc;
  }
  if (obj.videoRenderer) acc.push(obj.videoRenderer);
  if (obj.compactVideoRenderer) acc.push(obj.compactVideoRenderer);
  if (obj.gridVideoRenderer) acc.push(obj.gridVideoRenderer);
  for (const v of Object.values(obj)) findVideoRenderers(v, acc);
  return acc;
}

function parseVideoRenderer(vr: any, fallbackCategory?: VideoCategory): ScrapedVideoClient | null {
  try {
    const id = vr.videoId;
    if (!id) return null;
    const title = getText(vr.title);
    const channel = getText(vr.ownerText) || getText(vr.shortBylineText) || getText(vr.longBylineText);
    const channelId = vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || vr.channelId;
    const views = getText(vr.viewCountText) || getText(vr.shortViewCountText);
    const uploaded = getText(vr.publishedTimeText);
    let duration = getText(vr.lengthText);
    if (!duration) {
      const overlay = vr.thumbnailOverlays?.find?.((o: any) => o.thumbnailOverlayTimeStatusRenderer);
      if (overlay) duration = getText(overlay.thumbnailOverlayTimeStatusRenderer.text);
    }
    const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

    let isShort = false;
    if (vr.thumbnailOverlays?.some?.((o: any) => o.thumbnailOverlayTimeStatusRenderer?.style === "SHORTS")) {
      isShort = true;
    }
    if (duration && /^\d+:\d{2}$/.test(duration) && parseInt(duration.split(":")[0], 10) < 1) {
      isShort = true;
    }
    return {
      id, title, channel, channelId,
      category: fallbackCategory || inferCategory(`${title} ${channel}`),
      duration, views, uploaded, thumbnail: thumb, isShort,
    };
  } catch { return null; }
}

// ── Client-side YouTube scrapers (used only inside Capacitor) ───────────

async function clientSearchYouTube(query: string, opts: { limit?: number; category?: VideoCategory | "All"; page?: number } = {}): Promise<ScrapedVideoClient[]> {
  const limit = Math.min(opts.limit ?? 30, 50);
  const page = Math.max(1, opts.page ?? 1);
  const trimmed = query.trim();
  if (!trimmed) return [];
  let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
  if (page > 1) url += `&page=${page}`;
  const html = await fetchYtHtmlViaProxy(url);
  const data = extractJson(html, [
    /window\["ytInitialData"\]\s*=\s*/,
    /ytInitialData\s*=\s*/,
  ]);
  if (!data) return [];
  const renderers = findVideoRenderers(data);
  const seen = new Set<string>();
  const out: ScrapedVideoClient[] = [];
  for (const vr of renderers) {
    const v = parseVideoRenderer(vr, opts.category === "All" || !opts.category ? undefined : opts.category);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

async function clientFetchTrending(limit: number): Promise<ScrapedVideoClient[]> {
  try {
    const html = await fetchYtHtmlViaProxy("https://www.youtube.com/feed/trending");
    const data = extractJson(html, [
      /window\["ytInitialData"\]\s*=\s*/,
      /ytInitialData\s*=\s*/,
    ]);
    if (!data) return [];
    const renderers = findVideoRenderers(data);
    const seen = new Set<string>();
    const out: ScrapedVideoClient[] = [];
    for (const vr of renderers) {
      const v = parseVideoRenderer(vr);
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function clientFetchShorts(limit: number, page: number): Promise<ScrapedVideoClient[]> {
  // Trending Shorts shelf (page 1).
  if (page === 1) {
    try {
      const url = "https://www.youtube.com/feed/trending?bp=4gINGgt5dG1hX2NoYXJ0X2J5dGVtX3Nob3J0cw%3D%3D";
      const html = await fetchYtHtmlViaProxy(url);
      const data = extractJson(html, [
        /window\["ytInitialData"\]\s*=\s*/,
        /ytInitialData\s*=\s*/,
      ]);
      if (data) {
        // Walk for reelItemRenderer + shortsLockupViewModel.
        const shorts = findReelItems(data);
        if (shorts.length > 0) return shorts.slice(0, limit);
      }
    } catch {}
  }
  // Fallback: search #shorts.
  const results = await clientSearchYouTube("#shorts", { limit: limit * 2, page });
  const shortsOnly = results.filter((v) => v.isShort || (v.duration && /^\d+:\d{2}$/.test(v.duration) && parseInt(v.duration.split(":")[0], 10) < 1));
  if (shortsOnly.length > 0) return shortsOnly.slice(0, limit);
  return results.map((v) => ({ ...v, isShort: true })).slice(0, limit);
}

function findReelItems(obj: any, acc: ScrapedVideoClient[] = [], seen: Set<string> = new Set()): ScrapedVideoClient[] {
  if (!obj || typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    for (const v of obj) findReelItems(v, acc, seen);
    return acc;
  }
  if (obj.reelItemRenderer) {
    const r = obj.reelItemRenderer;
    const id = r.videoId;
    if (id && !seen.has(id)) {
      seen.add(id);
      acc.push({
        id,
        title: getText(r.headline) || "Short",
        channel: getText(r.shortBylineText) || "YouTube Short",
        category: "Live",
        thumbnail: r.thumbnail?.thumbnails?.slice(-1)[0]?.url,
        isShort: true,
        views: getText(r.viewCountText),
      });
    }
  }
  if (obj.shortsLockupViewModel) {
    const sl = obj.shortsLockupViewModel;
    const id = sl.entityId?.replace(/^shorts./, "") || sl.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
    if (id && !seen.has(id)) {
      seen.add(id);
      acc.push({
        id,
        title: sl.overlayMetadata?.primaryText?.content || "Short",
        channel: "YouTube Short",
        category: "Live",
        thumbnail: sl.thumbnail?.sources?.slice(-1)[0]?.url,
        isShort: true,
        views: sl.overlayMetadata?.secondaryText?.content,
      });
    }
  }
  for (const v of Object.values(obj)) findReelItems(v, acc, seen);
  return acc;
}

async function clientFetchRelated(videoId: string, limit: number): Promise<ScrapedVideoClient[]> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetchYtHtmlViaProxy(url);
    const data = extractJson(html, [
      /window\["ytInitialData"\]\s*=\s*/,
      /ytInitialData\s*=\s*/,
    ]);
    if (!data) return [];
    const renderers = findVideoRenderers(data);
    const seen = new Set<string>([videoId]);
    const out: ScrapedVideoClient[] = [];
    for (const vr of renderers) {
      const v = parseVideoRenderer(vr);
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
      if (out.length >= limit) break;
    }
    return out;
  } catch { return []; }
}

async function clientFetchVideoMetadata(videoId: string): Promise<ScrapedVideoClient | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetchYtHtmlViaProxy(url);
    const data = extractJson(html, [
      /window\["ytInitialPlayerResponse"\]\s*=\s*/,
      /ytInitialPlayerResponse\s*=\s*/,
    ]);
    if (!data) return null;
    const d = data.videoDetails;
    if (!d) return null;
    let duration: string | undefined;
    if (d.lengthSeconds) {
      const total = parseInt(d.lengthSeconds, 10);
      if (!isNaN(total)) {
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        duration = h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${m}:${String(s).padStart(2, "0")}`;
      }
    }
    let views: string | undefined;
    if (d.viewCount) {
      const n = parseInt(d.viewCount, 10);
      if (!isNaN(n)) {
        if (n >= 1_000_000_000) views = `${(n / 1_000_000_000).toFixed(1)}B`;
        else if (n >= 1_000_000) views = `${(n / 1_000_000).toFixed(1)}M`;
        else if (n >= 1_000) views = `${(n / 1_000).toFixed(1)}K`;
        else views = String(n);
      }
    }
    return {
      id: videoId,
      title: d.title || "YouTube video",
      channel: d.author || "Unknown channel",
      channelId: d.channelId,
      category: inferCategory(`${d.title} ${d.author}`),
      duration,
      views,
      thumbnail: d.thumbnail?.thumbnails?.slice(-1)[0]?.url,
      isShort: d.lengthSeconds ? parseInt(d.lengthSeconds, 10) <= 60 : false,
    };
  } catch { return null; }
}

async function clientFetchSuggestions(q: string, limit: number): Promise<string[]> {
  try {
    const target = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&output=text&q=${encodeURIComponent(q)}`;
    // Suggestions endpoint actually does support CORS in some cases — try direct first.
    let text: string;
    try {
      const res = await fetch(target, {
        headers: { "Accept": "text/plain;charset=utf-8" },
      });
      if (res.ok) {
        text = await res.text();
      } else {
        const proxyRes = await fetchWithProxy(target);
        text = await proxyRes.text();
      }
    } catch {
      const proxyRes = await fetchWithProxy(target);
      text = await proxyRes.text();
    }
    const suggestions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && typeof item[0] === "string") {
            suggestions.push(item[0]);
          }
          if (suggestions.length >= limit) break;
        }
      }
    } catch {
      const matches = text.matchAll(/\["([^"]+)",\[\d+\]\]/g);
      for (const m of matches) {
        suggestions.push(m[1]);
        if (suggestions.length >= limit) break;
      }
    }
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const s of suggestions) {
      const t = s.trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      cleaned.push(t);
      if (cleaned.length >= limit) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

// ── Unified API client ─────────────────────────────────────────────────
//
// On web (dev / hosted Next.js): uses `/api/*` server routes.
// In Capacitor (APK): uses client-side scrapers via CORS proxy.
//
// The shape of every response is identical to the server-side API so the
// frontend components don't need to know which path they're on.

export interface ApiClient {
  catalog(opts: {
    category: VideoCategory | "All";
    limit: number;
    page: number;
    except?: string[];
  }): Promise<{
    videos: ScrapedVideoClient[];
    source: string;
    category?: string;
    page: number;
    hasMore?: boolean;
    error?: string;
  }>;

  search(opts: {
    q: string;
    category: VideoCategory | "All";
    limit: number;
    page: number;
    except?: string[];
  }): Promise<{
    videos: ScrapedVideoClient[];
    source: string;
    query?: string;
    category?: string;
    page: number;
    hasMore?: boolean;
    error?: string;
  }>;

  video(videoId: string): Promise<{
    video: ScrapedVideoClient;
    source: string;
  }>;

  related(videoId: string, opts: { limit?: number; token?: string }): Promise<{
    videos: ScrapedVideoClient[];
    nextToken?: string;
    hasMore: boolean;
  }>;

  shorts(opts: { limit: number; page: number; except?: string[] }): Promise<{
    videos: ScrapedVideoClient[];
    source: string;
    page: number;
    hasMore?: boolean;
  }>;

  suggestions(q: string, limit?: number): Promise<{ suggestions: string[] }>;

  download(opts: { url: string; quality: string }): Promise<any>;
}

// ── Capacitor (client-side) implementation ──────────────────────────────

const capacitorApi: ApiClient = {
  async catalog({ category, limit, page, except = [] }) {
    if (category === "All" && page === 1) {
      const trending = await clientFetchTrending(limit * 2);
      const filtered = trending.filter((v) => !except.includes(v.id));
      if (filtered.length > 0) {
        return {
          videos: filtered.slice(0, limit),
          source: "youtube-trending",
          category,
          page,
          hasMore: true,
        };
      }
    }
    // Page 2+ in capacitor mode — fall back to search for popular query.
    if (page > 1) {
      const results = await clientSearchYouTube("trending", { limit, page });
      const filtered = results.filter((v) => !except.includes(v.id));
      return {
        videos: filtered,
        source: "youtube-search",
        category,
        page,
        hasMore: filtered.length >= limit,
      };
    }
    return {
      videos: [],
      source: "youtube-trending",
      category,
      page,
      hasMore: false,
    };
  },

  async search({ q, category, limit, page, except = [] }) {
    const trimmed = q.trim();
    if (!trimmed) return { videos: [], source: "rss-live", query: "", category, page };
    try {
      const scraped = await clientSearchYouTube(trimmed, { limit: limit * 2, category, page });
      const filtered = scraped.filter((v) => !except.includes(v.id));
      return {
        videos: filtered.slice(0, limit),
        source: "youtube-search",
        query: trimmed,
        category,
        page,
        hasMore: scraped.length >= limit,
      };
    } catch (e: any) {
      return {
        videos: [],
        source: "youtube-search",
        query: trimmed,
        category,
        page,
        hasMore: false,
        error: e?.message,
      };
    }
  },

  async video(videoId) {
    const v = await clientFetchVideoMetadata(videoId);
    if (v && v.title !== "YouTube video") {
      return { video: v, source: "youtube-scrape" };
    }
    return {
      video: {
        id: videoId,
        title: "YouTube video",
        channel: "Unknown",
        category: "Tech" as VideoCategory,
      },
      source: "minimal",
    };
  },

  async related(videoId, { limit = 20, token }) {
    // We don't support InnerTube continuation in capacitor mode (the API
    // doesn't support CORS even through the proxies we use). The first
    // page from the watch-page scrape is the only page.
    if (token) return { videos: [], hasMore: false };
    const videos = await clientFetchRelated(videoId, limit);
    return { videos, hasMore: false };
  },

  async shorts({ limit, page, except = [] }) {
    const shorts = await clientFetchShorts(limit, page);
    const filtered = shorts.filter((v) => !except.includes(v.id));
    return {
      videos: filtered,
      source: "youtube-shorts",
      page,
      hasMore: filtered.length >= limit,
    };
  },

  async suggestions(q, limit = 10) {
    const suggestions = await clientFetchSuggestions(q, limit);
    return { suggestions };
  },

  async download({ url, quality }) {
    // In capacitor mode we use the public Cobalt API directly (with CORS).
    const QUALITY_MAP: Record<string, string> = {
      "144p": "144", "240p": "240", "360p": "360",
      "480p": "480", "720p": "720", "1080p": "1080",
    };
    const q = QUALITY_MAP[quality] || "720";
    try {
      // Public Cobalt instance supports CORS.
      const res = await fetch("https://api.cobalt.tools/api/json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          url,
          vQuality: q,
          vCodec: "h264",
          isAudioOnly: false,
        }),
      });
      if (!res.ok) {
        return { status: "error", error: `Cobalt responded with HTTP ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { status: "error", error: e?.message || "Download service unavailable" };
    }
  },
};

// ── Web (Next.js server routes) implementation ──────────────────────────

const webApi: ApiClient = {
  async catalog({ category, limit, page, except = [] }) {
    const params = new URLSearchParams({
      category,
      limit: String(limit),
      page: String(page),
    });
    if (except.length > 0) params.set("except", except.slice(-500).join(","));
    const res = await fetch(`/api/catalog?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load videos");
    return res.json();
  },

  async search({ q, category, limit, page, except = [] }) {
    const params = new URLSearchParams({
      q, category, limit: String(limit), page: String(page),
    });
    if (except.length > 0) params.set("except", except.slice(-500).join(","));
    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },

  async video(videoId) {
    const res = await fetch(`/api/video/${videoId}`);
    if (!res.ok) throw new Error("Failed to load video");
    return res.json();
  },

  async related(videoId, { limit = 20, token }) {
    const url = token
      ? `/api/related/${videoId}?token=${encodeURIComponent(token)}&limit=${limit}`
      : `/api/related/${videoId}?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return { videos: [], hasMore: false };
    return res.json();
  },

  async shorts({ limit, page, except = [] }) {
    const params = new URLSearchParams({
      limit: String(limit), page: String(page),
    });
    if (except.length > 0) params.set("except", except.slice(-200).join(","));
    const res = await fetch(`/api/shorts?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load shorts");
    return res.json();
  },

  async suggestions(q, limit = 10) {
    const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!res.ok) return { suggestions: [] };
    return res.json();
  },

  async download({ url, quality }) {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, quality }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { status: "error", error: txt || `HTTP ${res.status}` };
    }
    return res.json();
  },
};

/**
 * Pick the right API client based on the runtime. Memoized so the choice
 * is made once per session.
 */
let cachedClient: ApiClient | null = null;
export function apiClient(): ApiClient {
  if (cachedClient) return cachedClient;
  cachedClient = isCapacitor() ? capacitorApi : webApi;
  return cachedClient;
}
