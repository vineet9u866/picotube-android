"use client";

import { useQuery } from "@tanstack/react-query";
import { VideoGrid } from "./video-grid";
import { CategoryChips } from "./category-chips";
import { useAppStore } from "@/store/app-store";
import { SearchX } from "lucide-react";

interface ApiVideo {
  id: string;
  title: string;
  channel: string;
  category: string;
  duration?: string;
  views?: string;
  uploaded?: string;
}

export function SearchView({ query }: { query: string }) {
  const activeCategory = useAppStore((s) => s.activeCategory);

  const { data, isLoading, isError, refetch } = useQuery<{ videos: ApiVideo[] }>({
    queryKey: ["search", query, activeCategory],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        category: activeCategory,
        limit: "30",
      });
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: query.trim().length > 0,
    staleTime: 60_000,
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
          {data?.videos && (
            <span className="text-[11px] text-muted-foreground">
              &middot; {data.videos.length} {data.videos.length === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        {isError ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Search failed. <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        ) : !isLoading && (data?.videos?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No results for <span className="font-semibold">{query}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Try a different keyword or category. Tip: set YOUTUBE_API_KEY for live YouTube search.
            </p>
          </div>
        ) : (
          <VideoGrid videos={data?.videos || []} loading={isLoading} skeletonCount={14} />
        )}
      </div>
    </div>
  );
}
