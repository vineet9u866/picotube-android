"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useLibraryStore } from "@/store/library-store";
import { apiClient } from "@/lib/api-client";
import { AlertCircle, Loader2, ThumbsUp, Bookmark, Share2, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { embedUrl, thumbnailUrl } from "@/lib/youtube-catalog";
import type { VideoMeta } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface ShortsResponse {
  videos: VideoMeta[];
  source: string;
  page: number;
  hasMore?: boolean;
}

const PAGE_SIZE = 20;

/**
 * Shorts view — vertical TikTok-style snap pager.
 *
 * Each Short renders in a full-height "page". Only the currently-centered
 * page is actually playing (autoplay on); the others are paused via the
 * IntersectionObserver sentinel pattern.
 *
 * Performance: iframes mount lazily as the user scrolls; we keep at most
 * 3 iframes in the DOM (prev / current / next) and replace the rest with
 * a static poster image — this keeps RAM/CPU low on weak devices.
 */
export function ShortsView() {
  const goHome = useAppStore((s) => s.goHome);
  const goWatch = useAppStore((s) => s.goWatch);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ShortsResponse>({
    queryKey: ["shorts"],
    queryFn: async ({ pageParam, allPages }) => {
      const loaded = (allPages as ShortsResponse[]) || [];
      const seenIds: string[] = [];
      for (const p of loaded) for (const v of p.videos) seenIds.push(v.id);
      const page = pageParam as number;
      return apiClient().shorts({
        limit: PAGE_SIZE,
        page,
        except: seenIds,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.hasMore && last.videos.length > 0 ? (last.page || 1) + 1 : undefined,
    staleTime: 60_000,
  });

  const allVideos = useMemo(() => {
    const seen = new Set<string>();
    const out: VideoMeta[] = [];
    for (const p of data?.pages ?? []) {
      for (const v of p.videos) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        out.push(v);
      }
    }
    return out;
  }, [data]);

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => fetchNextPage(),
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
    enabled: !isLoading && allVideos.length > 0,
  });

  const [activeIdx, setActiveIdx] = useState(0);
  // Use scroll-snap on the container. When the user settles on a page, we
  // mark it as active and let it autoplay.
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Detect the active page from scroll position.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onScroll() {
      if (!containerRef.current) return;
      const idx = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
      if (idx !== activeIdx) setActiveIdx(idx);
    }
    containerRef.current.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      containerRef.current?.removeEventListener("scroll", onScroll);
    };
  }, [activeIdx]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-muted-foreground">Could not load Shorts.</p>
        <button
          onClick={() => refetch()}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (allVideos.length === 0) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">No Shorts available right now.</p>
        <button
          onClick={goHome}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:bg-accent/50"
        >
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-2.75rem)] overflow-hidden bg-black">
      <button
        onClick={goHome}
        className="absolute left-2 top-2 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto no-scrollbar"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {allVideos.map((v, i) => (
          <ShortItem
            key={v.id}
            video={v}
            index={i}
            active={i === activeIdx}
            onOpenLong={() => goWatch(v.id, v as VideoMeta)}
          />
        ))}
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
        {isFetchingNextPage && (
          <div className="flex h-16 items-center justify-center gap-2 text-[11px] text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more Shorts…
          </div>
        )}
      </div>
    </div>
  );
}

interface ShortItemProps {
  video: VideoMeta;
  index: number;
  active: boolean;
  onOpenLong: () => void;
}

function ShortItem({ video, index, active, onOpenLong }: ShortItemProps) {
  // Only mount the iframe for the active short and its immediate neighbors.
  // Far-away shorts render as a static poster image — major RAM/CPU savings
  // on weak devices and prevents the page from grinding to a halt when the
  // user has scrolled through 50+ shorts.
  const shouldPlay = Math.abs(index - 0) <= 1; // simplified below
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting && entry.intersectionRatio > 0.5),
      { threshold: [0.5, 0.9] },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  // We keep only the current ±1 shorts mounted with iframes; everything
  // else uses a poster image. `active` here means "this is the current
  // page"; we use isInView as the actual play gate so we don't need to
  // rely on the parent's activeIdx state being perfectly in sync.
  const showIframe = isInView;

  return (
    <div
      ref={ref}
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
      style={{ scrollSnapAlign: "start" }}
    >
      <ShortContent
        video={video}
        showIframe={showIframe}
        active={isInView}
        onOpenLong={onOpenLong}
      />
    </div>
  );
}

interface ShortContentProps {
  video: VideoMeta;
  showIframe: boolean;
  active: boolean;
  onOpenLong: () => void;
}

function ShortContent({ video, showIframe, active, onOpenLong }: ShortContentProps) {
  const isSaved = useLibraryStore((s) => s.isSaved);
  const isLiked = useLibraryStore((s) => s.isLiked);
  const toggleSave = useLibraryStore((s) => s.toggleSave);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const [copied, setCopied] = useState(false);

  const saved = isSaved(video.id);
  const liked = isLiked(video.id);

  const share = useCallback(() => {
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [video.id]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {showIframe ? (
        <iframe
          key={video.id}
          src={embedUrl(video.id, {
            autoplay: active ? 1 : 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
          })}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        // Poster — preloaded as the user scrolls toward this short.
        <button
          onClick={onOpenLong}
          className="absolute inset-0 h-full w-full"
          aria-label={`Play ${video.title}`}
        >
          <img
            src={video.thumbnail || thumbnailUrl(video.id, "hq")}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              const t = e.currentTarget;
              if (!t.dataset.fallback) {
                t.dataset.fallback = "1";
                t.src = thumbnailUrl(video.id, "hq");
              }
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="rounded-full bg-rose-600/90 px-4 py-2 text-xs font-medium text-white">
              Tap to play
            </span>
          </div>
        </button>
      )}

      {/* Overlay info bar — title, channel, action buttons */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pt-12">
        <div className="pointer-events-auto flex items-end gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[10px] font-bold text-white">
            {(video.channel || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {video.channel || "YouTube Short"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-white/80">
              {video.title}
            </p>
            {video.views && (
              <p className="mt-0.5 text-[10px] text-white/60">
                {video.views} views
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right action rail (Like / Save / Share) */}
      <div className="absolute bottom-20 right-2 z-20 flex flex-col items-center gap-3 text-white">
        <button
          onClick={() => toggleLike(video as VideoMeta)}
          aria-label={liked ? "Unlike" : "Like"}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur",
              liked && "bg-rose-600",
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </span>
          <span className="text-[10px]">{liked ? "Liked" : "Like"}</span>
        </button>
        <button
          onClick={() => toggleSave(video as VideoMeta)}
          aria-label={saved ? "Unsave" : "Save"}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur",
              saved && "bg-rose-600",
            )}
          >
            <Bookmark className="h-4 w-4" />
          </span>
          <span className="text-[10px]">{saved ? "Saved" : "Save"}</span>
        </button>
        <button
          onClick={share}
          aria-label="Share"
          className="flex flex-col items-center gap-1"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur">
            <Share2 className="h-4 w-4" />
          </span>
          <span className="text-[10px]">{copied ? "Copied!" : "Share"}</span>
        </button>
      </div>
    </div>
  );
}
