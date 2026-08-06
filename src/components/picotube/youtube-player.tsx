"use client";

import { useSyncExternalStore } from "react";
import { embedUrl } from "@/lib/youtube-catalog";
import { cn } from "@/lib/utils";

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
}

// Returns false on server, true on client. Never re-renders after first commit.
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * YouTube iframe embed — official streaming mechanism.
 * Uses youtube-nocookie.com domain for privacy.
 * No cookies set unless the user plays the video.
 */
export function YouTubePlayer({ videoId, title, autoplay = true, className }: YouTubePlayerProps) {
  const isClient = useIsClient();

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-black",
        className,
      )}
    >
      {isClient && (
        <iframe
          key={videoId}
          src={embedUrl(videoId, { autoplay: autoplay ? 1 : 0 })}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}
      {!isClient && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs">
          Loading player...
        </div>
      )}
    </div>
  );
}
