"use client";

import { useMemo } from "react";
import { Play, Radio } from "lucide-react";
import type { CatalogVideo } from "@/lib/youtube-catalog";
import { thumbnailUrl } from "@/lib/youtube-catalog";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: CatalogVideo;
  className?: string;
}

export function VideoCard({ video, className }: VideoCardProps) {
  const goWatch = useAppStore((s) => s.goWatch);
  const isLive = video.duration?.toUpperCase() === "LIVE" || video.category === "Live";

  const thumbnail = useMemo(() => thumbnailUrl(video.id, "mq"), [video.id]);

  return (
    <button
      type="button"
      onClick={() => goWatch(video.id)}
      className={cn(
        "group flex flex-col text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-md",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
        <img
          src={thumbnail}
          alt={video.title}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-200",
            "group-hover:scale-[1.04] group-hover:brightness-95",
          )}
          onError={(e) => {
            // Fallback to hqdefault if mq fails (rare)
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = "1";
              target.src = thumbnailUrl(video.id, "hq");
            }
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600/90 text-white shadow-lg">
            <Play className="h-3.5 w-3.5 translate-x-[1px] fill-white" />
          </span>
        </div>

        {video.duration && (
          <span
            className={cn(
              "absolute bottom-1 right-1 rounded px-1 py-px text-[10px] font-medium leading-tight",
              isLive ? "bg-rose-600 text-white" : "bg-black/85 text-white",
            )}
          >
            {isLive ? (
              <span className="inline-flex items-center gap-1">
                <Radio className="h-2.5 w-2.5" /> LIVE
              </span>
            ) : video.duration}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[9px] font-bold text-white">
          {video.channel.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
            {video.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {video.channel}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {video.views && <span>{video.views} views</span>}
            {video.views && video.uploaded && <span> &middot; </span>}
            {video.uploaded && <span>{video.uploaded}</span>}
          </p>
        </div>
      </div>
    </button>
  );
}
