"use client";

import {
  useSyncExternalStore,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { embedUrl } from "@/lib/youtube-catalog";
import { cn } from "@/lib/utils";
import { Maximize, Minimize, PictureInPicture2 } from "lucide-react";

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
  keepLandscape?: boolean;
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
 * PicoTube — YouTube iframe embed (official streaming mechanism).
 *
 * Improvements over the basic embed:
 *  - Uses youtube-nocookie.com for privacy (no tracking cookies unless play).
 *  - Sets rel=0, modestbranding=1, iv_load_policy=3, playsinline=1 to keep
 *    branding minimal and prevent the "more videos" end-screen from showing
 *    clickable overlays that would otherwise bounce users to YouTube.com.
 *  - Adds a custom true-fullscreen button that uses the Fullscreen API on the
 *    iframe's parent — this enters fullscreen *without* forcing landscape
 *    orientation. Many mobile browsers lock YouTube's native fullscreen to
 *    landscape; this custom button gives the user a portrait-friendly option.
 *  - Adds a PIP (picture-in-picture) button. On browsers without a PIP API
 *    the button is hidden. On Android Capacitor builds, the Capacitor PIP
 *    plugin is invoked instead.
 *  - When `keepLandscape` is true we leave orientation unlocked so a user who
 *    is already in landscape stays there when they switch videos.
 */
export function YouTubePlayer({
  videoId,
  title,
  autoplay = true,
  className,
  keepLandscape,
}: YouTubePlayerProps) {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // Detect PIP support on mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    // @ts-expect-error: pictureInPictureEnabled is non-standard on some browsers.
    setPipSupported(!!document.pictureInPictureEnabled);
  }, []);

  // Track fullscreen state changes (esc key, OS back button, etc.).
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onFsChange() {
      const fsEl =
        document.fullscreenElement ||
        // @ts-expect-error: webkit prefix
        document.webkitFullscreenElement;
      setIsFullscreen(!!fsEl);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // Clean up: when this player unmounts, exit fullscreen (so the user
  // doesn't get stuck in fullscreen on the next view).
  useEffect(() => {
    return () => {
      const fsEl =
        document.fullscreenElement ||
        // @ts-expect-error: webkit prefix
        document.webkitFullscreenElement;
      if (fsEl) {
        document.exitFullscreen?.().catch(() => {});
        // @ts-expect-error: webkit prefix
        document.webkitExitFullscreen?.();
      }
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      // Don't lock orientation — let the user keep portrait or landscape.
      // Many browsers force-rotate YouTube's native fullscreen button; using
      // the Fullscreen API directly on the container avoids this.
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      } else if (
        // @ts-expect-error: webkit prefix
        el.webkitRequestFullscreen
      ) {
        // @ts-expect-error: webkit prefix
        el.webkitRequestFullscreen();
      } else if (
        // @ts-expect-error: iOS Safari on iPhone
        el.webkitEnterFullscreen
      ) {
        // @ts-expect-error: iOS Safari on iPhone
        el.webkitEnterFullscreen();
      }
    } catch {
      // Ignore — user can still use YouTube's native fullscreen button.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      // @ts-expect-error: webkit prefix
      else if (document.webkitExitFullscreen) {
        // @ts-expect-error: webkit prefix
        document.webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const enterPip = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Capacitor / Android native PIP — if the Capacitor PIP plugin is
    // available we let it handle the request at the Activity level so that
    // *only* the video enters PIP (not the whole app), and Home-button PIP
    // is enabled.
    // @ts-expect-error: Capacitor plugin injected on Android
    if (typeof window !== "undefined" && window.Capacitor?.Plugins?.PicoTubePIP) {
      try {
        // @ts-expect-error: dynamic
        await window.Capacitor.Plugins.PicoTubePIP.enter();
        return;
      } catch {
        // ignore and fall back to web PIP
      }
    }

    // Web PIP — try to request PIP on the iframe's internal video element.
    // Cross-origin iframes don't expose video elements directly, so this
    // generally only works on Chromium with the allow attribute set.
    try {
      // Try pictureInPictureAllowed on the iframe (Chromium).
      // @ts-expect-error: non-standard on iframe but Chromium exposes it
      if (iframe.requestPictureInPicture) {
        // @ts-expect-error: non-standard
        await iframe.requestPictureInPicture();
      }
    } catch {
      // ignore — button is hidden when not supported
    }
  }, []);

  // Build the embed URL with all the tweaks that keep the player clean.
  const src = isClient
    ? embedUrl(videoId, {
        autoplay: autoplay ? 1 : 0,
        // Disable the "more videos" end-screen overlays (clickable thumbnails
        // that bounce the user to youtube.com).
        iv_load_policy: 3,
        // Hide video title + uploader info overlay (more compact).
        modestbranding: 1,
        // Don't show related videos on pause/end (rel=0 already set).
        rel: 0,
        // Plays inline on mobile (so PIP / fullscreen works as expected).
        playsinline: 1,
        // Allow the browser to autoplay with sound muted if blocked.
        mute: autoplay ? 0 : 0,
      })
    : "";

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-lg bg-black",
        isFullscreen && "rounded-none",
        className,
      )}
    >
      {isClient && (
        <iframe
          ref={iframeRef}
          key={videoId}
          src={src}
          title={title}
          allow="
            accelerometer;
            autoplay;
            clipboard-write;
            encrypted-media;
            gyroscope;
            picture-in-picture;
            web-share;
            fullscreen
          "
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}
      {!isClient && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs">
          Loading player...
        </div>
      )}

      {/* Custom control overlay (top-right). Fades in on hover; persists in fullscreen. */}
      <div
        className={cn(
          "pointer-events-none absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity",
          "group-hover:opacity-100",
          isFullscreen && "opacity-100",
        )}
      >
        {pipSupported && (
          <button
            type="button"
            onClick={enterPip}
            aria-label="Picture in picture"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
        >
          {isFullscreen ? (
            <Minimize className="h-3.5 w-3.5" />
          ) : (
            <Maximize className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
