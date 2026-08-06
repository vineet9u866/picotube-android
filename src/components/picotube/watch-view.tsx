"use client";

import { useQuery } from "@tanstack/react-query";
import { YouTubePlayer } from "./youtube-player";
import { useAppStore, type VideoMeta } from "@/store/app-store";
import { ArrowLeft, Eye, Calendar, Clock, Radio, Share2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { thumbnailUrl } from "@/lib/youtube-catalog";

interface ApiVideoResponse {
  video: VideoMeta;
  source: string;
}

interface RelatedResponse {
  videos: VideoMeta[];
  source: string;
}

export function WatchView({ videoId }: { videoId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const goWatch = useAppStore((s) => s.goWatch);
  const cachedVideo = useAppStore((s) => s.videoCache[videoId]);
  const [copied, setCopied] = useState(false);

  // 1. Fetch video metadata — but only if not already in cache.
  //    The cache is populated when the user clicks a video from search/home,
  //    which is the common case.
  const { data: fetched, isLoading, isError } = useQuery<ApiVideoResponse>({
    queryKey: ["video", videoId],
    queryFn: async () => {
      const res = await fetch(`/api/video/${videoId}`);
      if (!res.ok) throw new Error("Failed to load video");
      return res.json();
    },
    enabled: !cachedVideo,
    staleTime: 30 * 60 * 1000,
  });

  const v: VideoMeta | undefined = cachedVideo || fetched?.video;

  // 2. Fetch related videos from YouTube search using the video title.
  //    Falls back gracefully if no title yet.
  const { data: relatedData } = useQuery<RelatedResponse>({
    queryKey: ["related", v?.title || videoId],
    queryFn: async () => {
      const q = v?.title ? v.title.slice(0, 60) : "";
      if (!q) return { videos: [], source: "none" };
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=15`);
      if (!res.ok) return { videos: [], source: "none" };
      const data = await res.json();
      // Exclude the current video from related.
      return {
        videos: (data.videos as VideoMeta[]).filter((x) => x.id !== videoId).slice(0, 12),
        source: data.source,
      };
    },
    enabled: !!v?.title,
    staleTime: 5 * 60 * 1000,
  });

  const related = relatedData?.videos || [];

  function share() {
    const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#/watch?v=${videoId}` : "";
    if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  }

  if (!v && isLoading) {
    return (
      <div className="px-2 py-3 sm:px-3">
        <div className="aspect-video w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!v && isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-muted-foreground">
          Video not found. It may have been removed or is unavailable.
        </p>
        <button
          onClick={goHome}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          Back to home
        </button>
      </div>
    );
  }

  // Even if we have no metadata, render the player — YouTube embed works
  // with just a video ID. This handles deep-link / paste-URL cases where
  // the metadata fetch failed (e.g. YouTube bot challenge).
  if (!v) {
    return (
      <div className="px-2 py-3 sm:px-3">
        <button
          onClick={goHome}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <YouTubePlayer videoId={videoId} title="YouTube video" />
        <p className="mt-2 text-xs text-muted-foreground">
          Loading metadata… playback has already started.
        </p>
      </div>
    );
  }

  const isLive = v.duration?.toUpperCase() === "LIVE" || v.category === "Live";

  return (
    <div className="px-2 py-3 sm:px-3">
      <button
        onClick={goHome}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main player + info */}
        <div className="min-w-0">
          <YouTubePlayer videoId={v.id} title={v.title} />

          <h1 className="mt-2.5 text-sm font-semibold leading-snug sm:text-base">{v.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {v.views && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {v.views} views
              </span>
            )}
            {v.uploaded && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {v.uploaded}
              </span>
            )}
            {v.duration && !isLive && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {v.duration}
              </span>
            )}
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-600 px-1.5 py-px text-[10px] font-semibold text-white">
                <Radio className="h-2.5 w-2.5" /> LIVE
              </span>
            )}
            <span className="rounded bg-accent px-1.5 py-px text-[10px]">{v.category}</span>
          </div>

          <div className="mt-3 flex items-center gap-2 border-y border-border py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[10px] font-bold text-white">
              {(v.channel || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{v.channel || "Unknown channel"}</p>
              <p className="text-[10px] text-muted-foreground">YouTube channel</p>
            </div>
            <button
              onClick={share}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium hover:bg-accent/70 transition-colors"
            >
              <Share2 className="h-3 w-3" />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>

          <div className="mt-3 rounded-md bg-accent/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Streaming via YouTube embed (youtube-nocookie). PicoTube has full
            access to YouTube&apos;s search, trending, and any channel — no API
            key, no accounts, no ads. Video metadata fetched server-side via
            YouTube&apos;s public pages; playback happens directly from
            YouTube&apos;s servers.
          </div>
        </div>

        {/* Related videos sidebar — fetched from YouTube search */}
        <div className="min-w-0">
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">Related</h2>
          <div className="flex flex-col gap-2.5">
            {related.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Loading related videos…</p>
            )}
            {related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => goWatch(r.id, r)}
                className="group flex gap-2 rounded-md text-left hover:bg-accent/50 p-1 transition-colors"
              >
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-muted sm:w-36">
                  <img
                    src={r.thumbnail || thumbnailUrl(r.id, "mq")}
                    alt={r.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      const t = e.currentTarget;
                      if (!t.dataset.fallback) {
                        t.dataset.fallback = "1";
                        t.src = thumbnailUrl(r.id, "hq");
                      }
                    }}
                  />
                  {r.duration && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-px text-[9px] font-medium text-white">
                      {r.duration}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-[11px] font-medium leading-snug group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {r.title}
                  </h3>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{r.channel}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.views && <span>{r.views} views</span>}
                    {r.views && r.uploaded && <span> &middot; </span>}
                    {r.uploaded && <span>{r.uploaded}</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
