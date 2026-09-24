import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * GET /api/search-suggestions?q=<partial>&limit=<n>
 *
 * Returns YouTube-style autocomplete suggestions while the user types.
 * We proxy Google's public suggestion endpoint
 * (suggestqueries.google.com/complete/search?client=youtube&ds=yt) — the
 * same one youtube.com uses for its search box — and parse the simple
 * text/plain response into a JSON array.
 *
 * The endpoint supports partial queries ("a few letters are enough") and
 * returns ~10 suggestions per request. We cache for 60s server-side via
 * Next's revalidate to keep latency low and avoid hammering Google.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 20);

  if (!q) return NextResponse.json({ suggestions: [] });

  try {
    const target = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&output=text&q=${encodeURIComponent(q)}`;
    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/plain;charset=utf-8",
      },
      // 60s server-side revalidate (in addition to the route revalidate).
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }
    const text = await res.text();

    // Response format: a JSON array of arrays, e.g.:
    // [["youtube music",[0]],["youtube movies",[0]], ...]
    // When output=text, the response is actually a JSON-ish array. We try
    // JSON.parse first; if that fails we fall back to a regex scraper.
    let suggestions: string[] = [];
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
      // Fallback: regex scrape
      const matches = text.matchAll(/\["([^"]+)",\[\d+\]\]/g);
      for (const m of matches) {
        suggestions.push(m[1]);
        if (suggestions.length >= limit) break;
      }
    }

    // Dedupe + trim.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const s of suggestions) {
      const t = s.trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      cleaned.push(t);
      if (cleaned.length >= limit) break;
    }

    return NextResponse.json({ suggestions: cleaned });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
