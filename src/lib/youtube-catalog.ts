/**
 * PicoTube — curated catalog of public YouTube videos.
 *
 * Each entry is hand-picked so the app works instantly without any API key.
 * Thumbnails use YouTube's CDN (always available). When YOUTUBE_API_KEY is
 * configured, the search API route supplements this catalog with live results.
 *
 * NOTE: All videos below are publicly available on YouTube. We only embed them
 * via YouTube's official iframe player — no streams are downloaded or proxied.
 */

export type VideoCategory =
  | "Music"
  | "Tech"
  | "Gaming"
  | "Science"
  | "Education"
  | "Comedy"
  | "Travel"
  | "Cooking"
  | "Sports"
  | "Trailers"
  | "Live"
  | "News";

export interface CatalogVideo {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  category: VideoCategory;
  /** ISO duration approximated for display — refreshed from API when key is set */
  duration?: string;
  views?: string;
  uploaded?: string;
}

/**
 * Helper: build a YouTube thumbnail URL from a video id.
 * hqdefault is a guaranteed 480x360 image for every public video.
 */
export function thumbnailUrl(id: string, quality: "hq" | "mq" | "sd" | "max" = "hq"): string {
  const map = {
    hq: "hqdefault",
    mq: "mqdefault",
    sd: "sddefault",
    max: "maxresdefault",
  } as const;
  return `https://i.ytimg.com/vi/${id}/${map[quality]}.jpg`;
}

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function embedUrl(id: string, params: Record<string, string | number | boolean> = {}): string {
  // Sensible defaults: rel=0 + modestbranding + playsinline + iv_load_policy=3
  // keeps the embed compact, hides end-screen "more videos" overlays that
  // would otherwise bounce users to youtube.com, and lets the video play
  // inline on mobile (so PIP / custom fullscreen work).
  const sp = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
  });
  // youtube-nocookie.com is the privacy-friendly variant — no cookies set
  // unless the user actually plays the video.
  return `https://www.youtube-nocookie.com/embed/${id}?${sp.toString()}`;
}

export function channelUrl(channelId?: string, fallbackName?: string): string {
  if (channelId) return `https://www.youtube.com/channel/${channelId}`;
  if (fallbackName) return `https://www.youtube.com/@${fallbackName}`;
  return "https://www.youtube.com";
}

export const CATALOG: CatalogVideo[] = [
  // ── Music ───────────────────────────────────────────────────────────────
  { id: "9bZkp7q19f0", title: "PSY - Gangnam Style", channel: "officialpsy", category: "Music", duration: "4:13", views: "5.0B", uploaded: "2012-07-15" },
  { id: "kJQP7kiw5Fk", title: "Luis Fonsi - Despacito ft. Daddy Yankee", channel: "LuisFonsiVEVO", category: "Music", duration: "4:42", views: "8.5B", uploaded: "2017-01-12" },
  { id: "RgKAFK5djSk", title: "Wiz Khalifa - See You Again ft. Charlie Puth", channel: "WizKhalifa", category: "Music", duration: "3:58", views: "6.4B", uploaded: "2015-04-06" },
  { id: "OPf0YbXqDm0", title: "Mark Ronson - Uptown Funk ft. Bruno Mars", channel: "MarkRonsonVEVO", category: "Music", duration: "4:31", views: "5.4B", uploaded: "2014-11-19" },
  { id: "fJ9rUzIMcZQ", title: "Queen – Bohemian Rhapsody", channel: "Queen Official", category: "Music", duration: "5:59", views: "1.9B", uploaded: "2008-08-01" },
  { id: "hT_nvWreIhg", title: "OneRepublic - Counting Stars", channel: "OneRepublicVEVO", category: "Music", duration: "4:43", views: "4.2B", uploaded: "2013-05-31" },
  { id: "YQHsXMglC9A", title: "Adele - Hello", channel: "AdeleVEVO", category: "Music", duration: "6:08", views: "3.5B", uploaded: "2015-10-22" },
  { id: "60ItHLz5WEA", title: "Alan Walker - Faded", channel: "Alan Walker", category: "Music", duration: "3:32", views: "3.7B", uploaded: "2015-12-03" },

  // ── Tech ────────────────────────────────────────────────────────────────
  { id: "TUVcZfQe-Kw", title: "Marques Brownlee - The Best Tech of the Year", channel: "MKBHD", category: "Tech", duration: "12:45", views: "4.2M", uploaded: "2023-12-15" },
  { id: "5MgBikgcWnY", title: "Dave2D - Laptop Buying Guide", channel: "Dave2D", category: "Tech", duration: "9:21", views: "1.8M", uploaded: "2024-01-10" },
  { id: "wfUN_IkQ0uk", title: "Linus Tech Tips - Building a $5000 PC", channel: "Linus Tech Tips", category: "Tech", duration: "18:32", views: "3.5M", uploaded: "2024-02-20" },
  { id: "4F72VULNl6U", title: "Mrwhosetheboss - Best Smartphones Tested", channel: "Mrwhosetheboss", category: "Tech", duration: "14:50", views: "5.1M", uploaded: "2024-03-05" },
  { id: "qHyVpQ73DzA", title: "Apple Vision Pro Review", channel: "The Verge", category: "Tech", duration: "16:08", views: "8.9M", uploaded: "2024-02-02" },

  // ── Gaming ──────────────────────────────────────────────────────────────
  { id: "8X2kIfS6fb8", title: "Minecraft Live Trailer", channel: "Minecraft", category: "Gaming", duration: "2:34", views: "12M", uploaded: "2023-10-15" },
  { id: "BdHRojSwgXM", title: "GTA VI Trailer 1", channel: "Rockstar Games", category: "Trailers", duration: "1:31", views: "210M", uploaded: "2023-12-05" },
  { id: "NLc48B-AI-8", title: "Cyberpunk 2077: Phantom Liberty", channel: "Cyberpunk 2077", category: "Gaming", duration: "1:42", views: "32M", uploaded: "2023-09-14" },
  { id: "qC5KtatMcUw", title: "Hollow Knight: Silksong Gameplay", channel: "Team Cherry", category: "Gaming", duration: "2:01", views: "9.4M", uploaded: "2022-06-12" },
  { id: "Jb4prVsXkZU", title: "PlayStation 5 Pro Reveal", channel: "PlayStation", category: "Gaming", duration: "1:52", views: "15M", uploaded: "2024-09-12" },

  // ── Science ─────────────────────────────────────────────────────────────
  { id: "Qd6nLM2QlWw", title: "Veritasium - The Science of Thought", channel: "Veritasium", category: "Science", duration: "23:14", views: "8.2M", uploaded: "2023-11-20" },
  { id: "BickMFHAZR0", title: "Kurzgesagt - The Largest Star in the Universe", channel: "Kurzgesagt", category: "Science", duration: "12:18", views: "32M", uploaded: "2023-12-01" },
  { id: "Pj-h6MEgE7I", title: "Mark Rober - World's Largest Devil's Toothpaste Eruption", channel: "Mark Rober", category: "Science", duration: "8:55", views: "150M", uploaded: "2021-10-25" },
  { id: "SlYxvhotel4", title: "SmarterEveryDay - How a Bullet Travels Through Glass", channel: "SmarterEveryDay", category: "Science", duration: "11:22", views: "12M", uploaded: "2022-04-18" },

  // ── Education ───────────────────────────────────────────────────────────
  { id: "aircAruvnKk", title: "3Blue1Brown - But what is a Neural Network?", channel: "3Blue1Brown", category: "Education", duration: "19:13", views: "18M", uploaded: "2017-10-05" },
  { id: "LkfQ-2OqdtA", title: "TED - The Power of Vulnerability — Brené Brown", channel: "TED", category: "Education", duration: "20:19", views: "65M", uploaded: "2010-12-01" },
  { id: "_uQrJ0TkZlc", title: "Python Full Course for Beginners", channel: "Programming with Mosh", category: "Education", duration: "6:14:07", views: "45M", uploaded: "2018-08-09" },
  { id: "PkZNo7MFNFg", title: "Learn JavaScript - Full Course for Beginners", channel: "freeCodeCamp.org", category: "Education", duration: "3:26:42", views: "12M", uploaded: "2018-12-10" },

  // ── Comedy ──────────────────────────────────────────────────────────────
  { id: "VbcYU0iZ_dI", title: "Key & Peele - Substitute Teacher", channel: "Comedy Central", category: "Comedy", duration: "2:50", views: "180M", uploaded: "2014-09-12" },
  { id: "BB0DU4DoPP4", title: "John Mulaney Stand-Up", channel: "Netflix Is A Joke", category: "Comedy", duration: "5:32", views: "8.5M", uploaded: "2022-04-22" },

  // ── Travel ──────────────────────────────────────────────────────────────
  { id: "5qap5aO4i9A", title: "lofi hip hop radio - beats to relax/study to", channel: "Lofi Girl", category: "Live", duration: "LIVE", views: "500M", uploaded: "2020-02-22" },
  { id: "Ie6oM-pXtvI", title: "4K Tokyo Night Walk", channel: "Tokyo Explorer", category: "Travel", duration: "31:24", views: "2.1M", uploaded: "2023-06-14" },
  { id: "g2nMKzhqc1s", title: "Iceland in 4K — A Cinematic Journey", channel: "4K Travel", category: "Travel", duration: "12:45", views: "5.7M", uploaded: "2023-09-22" },

  // ── Cooking ─────────────────────────────────────────────────────────────
  { id: "1eNXIhYaQqM", title: "Binging with Babish - Recipes from The Simpsons", channel: "Babish Culinary Universe", category: "Cooking", duration: "9:12", views: "8.2M", uploaded: "2020-03-17" },
  { id: "RpXnVHAMpwk", title: "Joshua Weissman - The Perfect Pizza", channel: "Joshua Weissman", category: "Cooking", duration: "14:35", views: "6.8M", uploaded: "2022-08-09" },

  // ── Sports ──────────────────────────────────────────────────────────────
  { id: "rW6q7T80nBA", title: "Top 50 Goals of the Season", channel: "FIFA", category: "Sports", duration: "10:24", views: "45M", uploaded: "2023-12-30" },
  { id: "v7oU5JD0FmE", title: "NBA — Top 100 Plays of the Year", channel: "NBA", category: "Sports", duration: "11:48", views: "12M", uploaded: "2023-06-15" },

  // ── Trailers ────────────────────────────────────────────────────────────
  { id: "giXco2jaZ_4", title: "Avatar: The Way of Water | Official Trailer", channel: "20th Century Studios", category: "Trailers", duration: "3:28", views: "180M", uploaded: "2022-05-09" },
  { id: "8g18jFHCLXk", title: "Dune: Part Two | Official Trailer", channel: "Warner Bros. Pictures", category: "Trailers", duration: "3:14", views: "65M", uploaded: "2023-06-03" },
  { id: "Way9Dexny3w", title: "Oppenheimer | Official Trailer", channel: "Universal Pictures", category: "Trailers", duration: "3:21", views: "85M", uploaded: "2023-05-08" },
  { id: "Df2r9D9oo5Q", title: "Interstellar | Official Trailer", channel: "Paramount Pictures", category: "Trailers", duration: "2:32", views: "55M", uploaded: "2014-07-22" },

  // ── News ────────────────────────────────────────────────────────────────
  { id: "F1Hq8eVOMHs", title: "SpaceX Starship Launch", channel: "SpaceX", category: "News", duration: "8:32", views: "22M", uploaded: "2023-11-18" },
  { id: "2UiNqn9OlOc", title: "NASA Mars Mission Briefing", channel: "NASA", category: "News", duration: "32:15", views: "5.4M", uploaded: "2024-01-08" },

  // ── Extra Tech / Coding ─────────────────────────────────────────────────
  { id: "Tn6-PIqc4UM", title: "React in 100 Seconds", channel: "Fireship", category: "Tech", duration: "1:42", views: "4.8M", uploaded: "2021-08-12" },
  { id: "lG7Uxts9SXs", title: "TypeScript — The Basics", channel: "Fireship", category: "Tech", duration: "2:48", views: "3.2M", uploaded: "2021-10-04" },
  { id: "1Cs0q7qB3JM", title: "Rust in 100 Seconds", channel: "Fireship", category: "Tech", duration: "1:48", views: "2.4M", uploaded: "2022-01-15" },
];

export const CATEGORIES: VideoCategory[] = [
  "Music",
  "Tech",
  "Gaming",
  "Science",
  "Education",
  "Comedy",
  "Travel",
  "Cooking",
  "Sports",
  "Trailers",
  "Live",
  "News",
];

/** Filter catalog by category and / or text query (case-insensitive). */
export function filterCatalog(opts: { category?: VideoCategory | "All"; query?: string; limit?: number }): CatalogVideo[] {
  const { category = "All", query = "", limit } = opts;
  const q = query.trim().toLowerCase();
  let result = CATALOG.filter((v) => {
    const okCat = category === "All" || v.category === category;
    const okQuery = !q ||
      v.title.toLowerCase().includes(q) ||
      v.channel.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q);
    return okCat && okQuery;
  });
  if (limit && result.length > limit) result = result.slice(0, limit);
  return result;
}

export function findCatalogVideo(id: string): CatalogVideo | undefined {
  return CATALOG.find((v) => v.id === id);
}
