"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { YouTubePlayer } from "./youtube-player";
import { useAppStore, type VideoMeta } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  Eye,
  Calendar,
  Clock,
  Radio,
  Share2,
  AlertCircle,
  Loader2,
  ThumbsUp,
  Bookmark,
  Download,
  ListPlus,
  History as HistoryIcon,
  Check,
} from "lucide-react";
import { useState, useMemo, useRef, Fragment, useEffect } from "react";
import { thumbnailUrl } from "@/lib/youtube-catalog";
import { AddToPlaylistDialog } from "./add-to-playlist-dialog";
import { DownloadDialog } from "./download-dialog";
import { cn } from "@/lib/utils";

interface ApiVideoResponse {
  video: VideoMeta;
  source: string;
}

interface RelatedResponse {
  videos: VideoMeta[];
  nextToken?: string;
  hasMore: boolean;
}

function formatViews(views?: string): string | null {
  if (!views) return null;
  // Strip any pre-existing " views" / "views" suffix that YouTube might send
  // back in the scraped string — the UI adds the word "views" itself.
  const stripped = String(views).replace(/\s*views?\s*$/i, "").trim();
  return stripped || null;
}

export function WatchView({ videoId }: { videoId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const goWatch = useAppStore((s) => s.goWatch);
  const keepLandscape = useAppStore((s) => s.keepLandscape);
  const cachedVideo = useAppStore((s) => s.videoCache[videoId]);
  const [copied, setCopied] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Library store hooks (toggles + state).
  const isSaved = useLibraryStore((s) => s.isSaved);
  const isLiked = useLibraryStore((s) => s.isLiked);
  const toggleSave = useLibraryStore((s) => s.toggleSave);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const recordWatch = useLibraryStore((s) => s.recordWatch);

  const saved = isSaved(videoId);
  const liked = isLiked(videoId);

  // 1. Fetch video metadata — but only if not already in cache.
  //    The cache is populated when the user clicks a video from home/search,
  //    which is the common case.
  const { data: fetched, isLoading, isError, refetch } = useQuery<ApiVideoResponse>({
    queryKey: ["video", videoId],
    queryFn: async () => apiClient().video(videoId),
    enabled: !cachedVideo,
    staleTime: 30 * 60 * 1000,
  });

  const v: VideoMeta | undefined = cachedVideo || fetched?.video;

  // 2. Fetch related videos from YouTube's own watch-page sidebar.
  //    First page scrapes the watch page; subsequent pages use the
  //    continuation token from YouTube's InnerTube API.
  const {
    data: relatedData,
    fetchNextPage: fetchNextRelated,
    hasNextPage: hasNextRelated,
    isFetchingNextPage: isFetchingNextRelated,
  } = useInfiniteQuery<RelatedResponse>({
    queryKey: ["related", videoId],
    queryFn: async ({ pageParam }) => {
      const token = pageParam as string | undefined;
      return apiClient().related(videoId, { token, limit: 20 });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.nextToken ? last.nextToken : undefined,
    enabled: !!v?.title,
    staleTime: 5 * 60 * 1000,
  });

  const related = useMemo(() => {
    const all = (relatedData?.pages?.flatMap((p) => p.videos) ?? []).filter(
      (x) => x.id !== videoId,
    );
    const seen = new Set<string>();
    return all.filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  }, [relatedData, videoId]);

  const relatedSentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => fetchNextRelated(),
    hasMore: hasNextRelated,
    isLoading: isFetchingNextRelated,
    enabled: !!v?.title,
  });

  // Record watch history when video metadata is available.
  useEffect(() => {
    if (v?.id) recordWatch(v);
  }, [v?.id, recordWatch, v]);

  function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#/watch?v=${videoId}`
        : "";
    if (navigator.clipboard && url) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {});
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
          onClick={() => refetch()}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          Retry
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
  const views = formatViews(v.views);

  return (
    <div className="px-2 py-3 sm:px-3">
      <button
        onClick={goHome}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main player + info */}
        <div className="min-w-0">
          <YouTubePlayer
            videoId={v.id}
            title={v.title}
            keepLandscape={keepLandscape}
          />

          <h1 className="mt-2.5 text-sm font-semibold leading-snug sm:text-base">
            {v.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {views && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {views} views
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
            <span className="rounded bg-accent px-1.5 py-px text-[10px]">
              {v.category}
            </span>
          </div>

          {/* Channel + Action bar (scrolls horizontally on small screens). */}
          <div className="mt-3 border-y border-border py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[10px] font-bold text-white">
                {(v.channel || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {v.channel || "Unknown channel"}
                </p>
                <p className="text-[10px] text-muted-foreground">YouTube channel</p>
              </div>
            </div>

            {/* Action buttons row — scrollable on narrow screens so nothing
                gets clipped. The "More" button on the far right scrolls the
                hidden actions into view. */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <ActionButton
                active={liked}
                onClick={() => toggleLike(v)}
                icon={
                  liked ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <ThumbsUp className="h-3.5 w-3.5" />
                  )
                }
                label={liked ? "Liked" : "Like"}
              />
              <ActionButton
                active={saved}
                onClick={() => toggleSave(v)}
                icon={
                  saved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )
                }
                label={saved ? "Saved" : "Save"}
              />
              <ActionButton
                onClick={() => setShowPlaylistDialog(true)}
                icon={<ListPlus className="h-3.5 w-3.5" />}
                label="Playlist"
              />
              <ActionButton
                onClick={() => setShowDownloadDialog(true)}
                icon={<Download className="h-3.5 w-3.5" />}
                label="Download"
              />
              <ActionButton
                onClick={share}
                icon={<Share2 className="h-3.5 w-3.5" />}
                label={copied ? "Copied!" : "Share"}
              />
            </div>
          </div>

          {/* Related videos sidebar — fetched from YouTube watch page */}
          <div className="mt-4 block lg:hidden">
            <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
              Up next
            </h2>
            <RelatedList
              related={related}
              relatedSentinelRef={relatedSentinelRef}
              isFetchingNextRelated={isFetchingNextRelated}
              hasNextRelated={hasNextRelated}
              onPick={(id, meta) => goWatch(id, meta)}
            />
          </div>
        </div>

        {/* Related videos sidebar (desktop) — fetched from YouTube watch page */}
        <div className="hidden min-w-0 lg:block">
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
            Up next
          </h2>
          <RelatedList
            related={related}
            relatedSentinelRef={relatedSentinelRef}
            isFetchingNextRelated={isFetchingNextRelated}
            hasNextRelated={hasNextRelated}
            onPick={(id, meta) => goWatch(id, meta)}
          />
        </div>
      </div>

      <AddToPlaylistDialog
        open={showPlaylistDialog}
        onOpenChange={setShowPlaylistDialog}
        video={v}
      />
      <DownloadDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        video={v}
      />
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function ActionButton({ onClick, icon, label, active }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-rose-600 text-white hover:bg-rose-700"
          : "bg-accent text-foreground hover:bg-accent/70",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface RelatedListProps {
  related: VideoMeta[];
  relatedSentinelRef: React.RefCallback<HTMLDivElement>;
  isFetchingNextRelated: boolean;
  hasNextRelated: boolean;
  onPick: (id: string, meta: VideoMeta) => void;
}

function RelatedList({
  related,
  relatedSentinelRef,
  isFetchingNextRelated,
  hasNextRelated,
  onPick,
}: RelatedListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {related.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Loading related videos…
        </p>
      )}
      {related.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onPick(r.id, r)}
          className="group flex w-full gap-2 rounded-md p-1 text-left hover:bg-accent/50 transition-colors"
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
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {r.channel}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {r.views && <span>{formatViews(r.views)}</span>}
              {r.views && r.uploaded && <span> &middot; </span>}
              {r.uploaded && <span>{r.uploaded}</span>}
            </p>
          </div>
        </button>
      ))}

      {/* Infinite scroll sentinel for related */}
      <div ref={relatedSentinelRef} className="h-8 w-full" aria-hidden />

      {isFetchingNextRelated && (
        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading more…
        </div>
      )}

      {!hasNextRelated && related.length > 0 && (
        <div className="py-2 text-center text-[10px] text-muted-foreground/60">
          End of related
        </div>
      )}
    </div>
  );
}
