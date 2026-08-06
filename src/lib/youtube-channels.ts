/**
 * PicoTube — list of YouTube channels to fetch content from via public RSS feeds.
 *
 * YouTube exposes a free, no-auth RSS feed for every channel:
 *   https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
 *
 * We poll these feeds server-side (no API key required) so the app always
 * shows fresh, real content straight from YouTube's servers. Each feed returns
 * the most recent ~15 uploads from that channel and refreshes every few hours.
 *
 * All channel IDs below are VERIFIED — each one was fetched and confirmed to
 * return a real YouTube RSS feed with the expected channel title.
 */

import type { VideoCategory } from "./youtube-catalog";

export interface ChannelSeed {
  channelId: string;
  handle: string;
  category: VideoCategory;
}

export const CHANNELS: ChannelSeed[] = [
  // ── Music ───────────────────────────────────────────────────────────────
  { channelId: "UCfM3zsQsOnfWNUppiycmBuw", handle: "Eminem", category: "Music" },
  { channelId: "UCsRM0YB_dabtEPGPTKo-gcw", handle: "Adele", category: "Music" },
  { channelId: "UC0WP5P-ufpRfjbNrmOWwLBQ", handle: "The Weeknd", category: "Music" },
  { channelId: "UC0C-w0YjGpqDXGB8IHb662A", handle: "Ed Sheeran", category: "Music" },

  // ── Tech ────────────────────────────────────────────────────────────────
  { channelId: "UCBJycsmduvYEL83R_U4JriQ", handle: "Marques Brownlee", category: "Tech" },
  { channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw", handle: "Linus Tech Tips", category: "Tech" },
  { channelId: "UCsBjURrPoezykLs9EqgamOA", handle: "Fireship", category: "Tech" },
  { channelId: "UCMiJRAwDNSNzuYeN2uWa0pA", handle: "Mrwhosetheboss", category: "Tech" },
  { channelId: "UC8ENHE5xdFSwx71u3fDH5Xw", handle: "ThePrimeagen", category: "Tech" },
  { channelId: "UCLCzFTjK2fZ_q4pGnewuikA", handle: "Theo - t3.gg", category: "Tech" },

  // ── Gaming ──────────────────────────────────────────────────────────────
  { channelId: "UC1sELGmy5jp5fQUugmuYlXQ", handle: "Minecraft", category: "Gaming" },
  { channelId: "UC6VcWc1rAoWdBCM0JxrRQ3A", handle: "Rockstar Games", category: "Gaming" },
  { channelId: "UC-2Y8dQb0S6DtpxNgAKoJKA", handle: "PlayStation", category: "Gaming" },
  { channelId: "UC4zyoIAzmdsgpDZQfO1-lSA", handle: "Cyberpunk 2077", category: "Gaming" },

  // ── Science ─────────────────────────────────────────────────────────────
  { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", handle: "Veritasium", category: "Science" },
  { channelId: "UCsXVk37bltHxD1rDPwtNM8Q", handle: "Kurzgesagt", category: "Science" },
  { channelId: "UC6107grRI4m0o2-emgoDnAA", handle: "SmarterEveryDay", category: "Science" },
  { channelId: "UCY1kMZp36IQSyNx_9h4mpCg", handle: "Mark Rober", category: "Science" },
  { channelId: "UC7_gcs09iThXybpVgjHZ_7g", handle: "PBS Space Time", category: "Science" },

  // ── Education ───────────────────────────────────────────────────────────
  { channelId: "UCYO_jab_esuFRV4b17AJtAw", handle: "3Blue1Brown", category: "Education" },
  { channelId: "UCAuUUnT6oDeKwE6v1NGQxug", handle: "TED", category: "Education" },
  { channelId: "UC8butISFwT-Wl7EV0hUK0BQ", handle: "freeCodeCamp.org", category: "Education" },
  { channelId: "UCWv7vMbMWH4-V0ZXdmDpPBA", handle: "Programming with Mosh", category: "Education" },

  // ── Comedy ──────────────────────────────────────────────────────────────
  { channelId: "UCdN4aXTrHAtfgbVG9HjBmxQ", handle: "Key & Peele", category: "Comedy" },
  { channelId: "UCObk_g1hQBy0RKKriVX_zOQ", handle: "Netflix Is A Joke", category: "Comedy" },

  // ── Travel ──────────────────────────────────────────────────────────────
  { channelId: "UCHWmg1FyYtFRiClvHkB-NVA", handle: "Tokyo Explorer", category: "Travel" },
  { channelId: "UC6-hIlxxgC-3RXWPWb6ik7g", handle: "4K Travel", category: "Travel" },

  // ── Cooking ─────────────────────────────────────────────────────────────
  { channelId: "UCJHA_jMfCvEnv-3kRjTCQXw", handle: "Binging with Babish", category: "Cooking" },
  { channelId: "UCJFp8uSYCjXOMnkUyb3CQ3Q", handle: "Tasty", category: "Cooking" },

  // ── Sports ──────────────────────────────────────────────────────────────
  { channelId: "UCpcTrCXblq78GZrTUTLWeBw", handle: "FIFA", category: "Sports" },
  { channelId: "UCWJ2lWNubArHWmf3FIHbfcQ", handle: "NBA", category: "Sports" },

  // ── Trailers ────────────────────────────────────────────────────────────
  { channelId: "UC2-BeLxzUBSs0uSrmzWhJuQ", handle: "20th Century Studios", category: "Trailers" },
  { channelId: "UCjmJDM5pRKbUlVIzDYYWb6g", handle: "Warner Bros.", category: "Trailers" },
  { channelId: "UCq0OueAsdxH6b8nyAspwViw", handle: "Universal Pictures", category: "Trailers" },

  // ── News ────────────────────────────────────────────────────────────────
  { channelId: "UCtI0Hodo5o5dUb67FeUjDeA", handle: "SpaceX", category: "News" },
  { channelId: "UCLA_DiR1FfKNvjuUpBHmylQ", handle: "NASA", category: "News" },

  // ── Live (24/7 streams / lofi radio) ────────────────────────────────────
  { channelId: "UCSJ4gkVC6NrvII8umztf0Ow", handle: "Lofi Girl", category: "Live" },
];

// De-duplicate by channelId (in case the same channel is listed twice).
export const CHANNELS_FINAL: ChannelSeed[] = Array.from(
  new Map(CHANNELS.map((c) => [c.channelId, c])).values(),
);
