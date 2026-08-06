"use client";

import { useQuery } from "@tanstack/react-query";
import { VideoGrid } from "./video-grid";
import { CategoryChips } from "./category-chips";
import { useAppStore } from "@/store/app-store";
import { AlertCircle } from "lucide-react";

interface ApiVideo {
  id: string;
  title: string;
  channel: string;
  category: string;
  duration?: string;
  views?: string;
  uploaded?: string;
}

export function HomeView() {
  const activeCategory = useAppStore((s) => s.activeCategory);

  const { data, isLoading, isError, refetch } = useQuery<{ videos: ApiVideo[] }>({
    queryKey: ["catalog", activeCategory],
    queryFn: async () => {
      const res = await fetch(`/api/catalog?category=${encodeURIComponent(activeCategory)}&limit=30`);
      if (!res.ok) throw new Error("Failed to load videos");
      return res.json();
    },
    staleTime: 60_000,
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
              {(data?.source === "youtube-trending" || data?.source === "youtube-search") && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Full YouTube access
                </span>
              )}
              {data?.source === "rss-live" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live from YouTube RSS
                </span>
              )}
              {data?.source === "catalog-fallback" && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  Showing catalog &middot; YouTube unreachable
                </span>
              )}
            </div>
            <VideoGrid videos={data?.videos || []} loading={isLoading} skeletonCount={14} />
            {!isLoading && (data?.videos?.length ?? 0) === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No videos in this category yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
