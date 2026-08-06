"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { YouTubePlayer } from "./youtube-player";
import { useAppStore, type VideoMeta } from "@/store/app-store";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
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
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { thumbnailUrl } from "@/lib/youtube-catalog";

interface ApiVideoResponse {
  video: VideoMeta;
  source: string;
}

interface RelatedResponse {
  videos: VideoMeta[];
  nextToken?: string;
  hasMore: boolean;
}

interface CommentItem {
  id: string;
  author: string;
  text: string;
  likes?: string;
  published?: string;
  avatar?: string;
  replies?: number;
}

interface CommentsResponse {
  comments: CommentItem[];
  nextPageToken?: string;
  hasMore: boolean;
}

export function WatchView({ videoId }: { videoId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const goWatch = useAppStore((s) => s.goWatch);
  const cachedVideo = useAppStore((s) => s.videoCache[videoId]);
  const [copied, setCopied] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // 1. Fetch video metadata — but only if not already in cache.
  //    The cache is populated when the user clicks a video from home/search,
  //    which is the common case.
  const { data: fetched, isLoading, isError, refetch } = useQuery<ApiVideoResponse>({
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
      const url = token
        ? `/api/related/${videoId}?token=${encodeURIComponent(token)}&limit=20`
        : `/api/related/${videoId}?limit=20`;
      const res = await fetch(url);
      if (!res.ok) return { videos: [], hasMore: false };
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.nextToken ? last.nextToken : undefined),
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

  // 3. Fetch comments via InnerTube API.
  const {
    data: commentsData,
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useInfiniteQuery<CommentsResponse>({
    queryKey: ["comments", videoId],
    queryFn: async ({ pageParam }) => {
      const token = pageParam as string | undefined;
      const url = token
        ? `/api/comments/${videoId}?token=${encodeURIComponent(token)}&limit=20`
        : `/api/comments/${videoId}?limit=20`;
      const res = await fetch(url);
      if (!res.ok) return { comments: [], hasMore: false };
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.nextPageToken ? last.nextPageToken : undefined,
    enabled: !!v?.title,
    staleTime: 5 * 60 * 1000,
  });

  const comments = commentsData?.pages?.flatMap((p) => p.comments) ?? [];
  const commentsLoaded = commentsData !== undefined;

  const commentsSentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => fetchNextComments(),
    hasMore: hasNextComments,
    isLoading: isFetchingNextComments,
    enabled: !!v?.title,
  });

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
  const description = v.description?.trim() || "";
  const isLongDesc = description.length > 200;
  const shownDesc =
    descExpanded || !isLongDesc ? description : description.slice(0, 200) + "…";

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

          {/* Description box */}
          {description ? (
            <div className="mt-3 rounded-md bg-accent/50 p-2.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/90">
                {shownDesc}
              </p>
              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded((x) => !x)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  {descExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-md bg-accent/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              No description available for this video. PicoTube fetches
              metadata directly from YouTube&apos;s public watch page — some
              videos don&apos;t include a description.
            </div>
          )}

          {/* Comments section */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold">Comments</h2>
              {comments.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  &middot; showing {comments.length}
                </span>
              )}
            </div>

            {!commentsLoaded ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded-md bg-accent/30 p-2 animate-pulse"
                  >
                    <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2.5 w-1/4 rounded bg-muted" />
                      <div className="h-2 w-full rounded bg-muted" />
                      <div className="h-2 w-3/4 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-md bg-accent/40 p-3 text-center text-[11px] text-muted-foreground">
                No comments available. YouTube may have comments disabled for
                this video, or they couldn&apos;t be loaded.
              </div>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-2 rounded-md bg-accent/40 p-2"
                  >
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.author}
                        loading="lazy"
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                        onError={(e) => {
                          (e.currentTarget.style.display = "none");
                        }}
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-700 text-[9px] font-bold text-white">
                        {(c.author || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="truncate text-[11px] font-semibold">
                          {c.author}
                        </p>
                        {c.published && (
                          <span className="text-[10px] text-muted-foreground">
                            {c.published}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/90">
                        {c.text}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                        {c.likes && (
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-2.5 w-2.5" /> {c.likes}
                          </span>
                        )}
                        {c.replies != null && c.replies > 0 && (
                          <span>
                            {c.replies} {c.replies === 1 ? "reply" : "replies"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Infinite scroll sentinel for comments */}
                <div ref={commentsSentinelRef} className="h-8 w-full" aria-hidden />

                {isFetchingNextComments && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading more comments…
                  </div>
                )}

                {!hasNextComments && comments.length > 0 && (
                  <div className="py-2 text-center text-[10px] text-muted-foreground/60">
                    End of comments
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Related videos sidebar — fetched from YouTube watch page */}
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
                className="group flex gap-2 rounded-md p-1 text-left hover:bg-accent/50 transition-colors"
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
                    {r.views && <span>{r.views} views</span>}
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
        </div>
      </div>
    </div>
  );
}
