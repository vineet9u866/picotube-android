"use client";

import { cn } from "@/lib/utils";
import { VideoCard } from "./video-card";
import type { CatalogVideo } from "@/lib/youtube-catalog";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoGridProps {
  videos: CatalogVideo[];
  loading?: boolean;
  className?: string;
  skeletonCount?: number;
}

export function VideoGrid({ videos, loading, className, skeletonCount = 12 }: VideoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
        className,
      )}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <Skeleton className="aspect-video w-full rounded-md" />
              <div className="mt-1.5 flex gap-1.5">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            </div>
          ))
        : videos.map((v) => <VideoCard key={v.id} video={v} />)}
    </div>
  );
}
