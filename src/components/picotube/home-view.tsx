"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { VideoGrid } from "./video-grid";
import { CategoryChips } from "./category-chips";
import { useAppStore } from "@/store/app-store";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { AlertCircle, Loader2 } from "lucide-react";
import { Fragment } from "react";
import type { VideoMeta } from "@/store/app-store";

interface ApiVideo {
  id: string;
  title: string;
  channel: string;
  category: string;
  duration?: string;
  views?: string;
  uploaded?: string;
  thumbnail?: string;
  description?: string;
}

interface CatalogResponse {
  videos: ApiVideo[];
  source: string;
  category?: string;
  page: number;
  hasMore?: boolean;
  error?: string;
}

const PAGE_SIZE = 24;

export function HomeView() {
  const activeCategory = useAppStore((s) => s.activeCategory);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CatalogResponse>({
    queryKey: ["catalog", activeCategory],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const res = await fetch(
        `/api/catalog?category=${encodeURIComponent(activeCategory)}&limit=${PAGE_SIZE}&page=${page}`,
      );
      if (!res.ok) throw new Error("Failed to load videos");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.hasMore && last.videos.length > 0 ? (last.page || 1) + 1 : undefined,
    staleTime: 60_000,
  });

  // Flatten all pages into a single video list.
  const allVideos: ApiVideo[] = data?.pages?.flatMap((p) => p.videos) ?? [];
  const firstPage = data?.pages?.[0];
  const source = firstPage?.source;
  const hasMore = !!hasNextPage;

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => fetchNextPage(),
    hasMore,
    isLoading: isFetchingNextPage,
    enabled: !isLoading,
  });

  return (
    <div className="flex flex-col">
      <CategoryChips />
      <div className="px-2 py-3 sm:px-3">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-sm text-muted-foreground">Could not load videos.</p>
            <button
              onClick={() => refetch()}
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground">
                {activeCategory === "All" ? "YouTube Trending" : activeCategory}
              </h2>
              {(source === "youtube-trending" || source === "youtube-search") && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Full YouTube access
                </span>
              )}
              {source === "rss-live" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live from YouTube RSS
                </span>
              )}
              {source === "catalog-fallback" && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  Showing catalog &middot; YouTube unreachable
                </span>
              )}
            </div>

            {isLoading ? (
              <VideoGrid videos={[]} loading skeletonCount={14} />
            ) : (
              <>
                {data?.pages?.map((page, i) => (
                  <Fragment key={i}>
                    {i > 0 && page.videos.length > 0 && (
                      <div className="my-3 border-t border-border/60" />
                    )}
                    <VideoGrid videos={page.videos as unknown as VideoMeta[]} />
                  </Fragment>
                ))}

                {allVideos.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No videos in this category yet.
                  </div>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-12 w-full" aria-hidden />

                {isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading more…
                  </div>
                )}

                {!hasMore && allVideos.length > 0 && (
                  <div className="py-4 text-center text-[10px] text-muted-foreground/60">
                    You&apos;ve reached the end
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
