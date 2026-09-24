"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { VideoGrid } from "./video-grid";
import { CategoryChips } from "./category-chips";
import { useAppStore } from "@/store/app-store";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { apiClient } from "@/lib/api-client";
import { SearchX, Loader2 } from "lucide-react";
import { Fragment, useMemo } from "react";
import type { VideoMeta } from "@/store/app-store";

interface SearchResponse {
  videos: VideoMeta[];
  source: string;
  query?: string;
  category?: string;
  page: number;
  error?: string;
  hasMore?: boolean;
}

const PAGE_SIZE = 24;

export function SearchView({ query }: { query: string }) {
  const activeCategory = useAppStore((s) => s.activeCategory);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SearchResponse>({
    queryKey: ["search", query, activeCategory],
    queryFn: async ({ pageParam, allPages }) => {
      const loadedPages = (allPages as SearchResponse[]) || [];
      const seenIds: string[] = [];
      for (const p of loadedPages) {
        for (const v of p.videos) seenIds.push(v.id);
      }

      const page = pageParam as number;
      return apiClient().search({
        q: query,
        category: activeCategory,
        limit: PAGE_SIZE,
        page,
        except: seenIds,
      });
    },
    enabled: query.trim().length > 0,
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.videos.length > 0 && last.hasMore !== false
        ? (last.page || 1) + 1
        : undefined,
    staleTime: 60_000,
  });

  const allPages = data?.pages ?? [];
  const allVideos = useMemo(() => {
    const seen = new Set<string>();
    const out: VideoMeta[] = [];
    for (const p of allPages) {
      for (const v of p.videos) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        out.push(v);
      }
    }
    return out;
  }, [allPages]);

  const firstPage = allPages[0];
  const source = firstPage?.source;
  const totalShown = allVideos.length;

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => fetchNextPage(),
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
    enabled: !isLoading && query.trim().length > 0,
  });

  return (
    <div className="flex flex-col">
      <CategoryChips />
      <div className="px-2 py-3 sm:px-3">
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground">
            Search results for
          </h2>
          <span className="text-sm font-bold text-foreground">{query}</span>
          {totalShown > 0 && (
            <span className="text-[11px] text-muted-foreground">
              &middot; {totalShown}+ {totalShown === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        {isError ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Search failed.{" "}
            <button onClick={() => refetch()} className="underline">
              Retry
            </button>
          </div>
        ) : !isLoading && totalShown === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No results for <span className="font-semibold">{query}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              PicoTube searches ALL of YouTube via server-side scraping. Try
              any keyword — videos, music, tutorials, anything.
            </p>
          </div>
        ) : (
          <>
            {source === "youtube-search" && (
              <p className="mb-2 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Full YouTube search results
              </p>
            )}
            {source === "rss-fallback" && (
              <p className="mb-2 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Showing RSS results (full YouTube search unavailable)
              </p>
            )}

            {isLoading ? (
              <VideoGrid videos={[]} loading skeletonCount={14} />
            ) : (
              <>
                {allPages.map((page, i) => (
                  <Fragment key={i}>
                    {i > 0 && page.videos.length > 0 && (
                      <div className="my-3 border-t border-border/60" />
                    )}
                    <VideoGrid videos={page.videos as unknown as VideoMeta[]} />
                  </Fragment>
                ))}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-12 w-full" aria-hidden />

                {isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading more results…
                  </div>
                )}

                {!hasNextPage && totalShown > 0 && (
                  <div className="py-4 text-center text-[10px] text-muted-foreground/60">
                    End of results
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
