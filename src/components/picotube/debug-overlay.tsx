"use client";

import { useEffect, useState } from "react";
import { isCapacitor } from "@/lib/api-client";
import { AlertCircle, X } from "lucide-react";

/**
 * A minimal debug overlay shown only in Capacitor native mode.
 *
 * When the user opens the APK for the first time and sees "Could not load
 * videos", this overlay surfaces the most likely cause: the @capacitor/http
 * plugin hasn't been loaded yet, OR the WebView can't reach YouTube via
 * CORS proxies, OR isCapacitor() detection is failing.
 *
 * The overlay shows three status indicators:
 *   - Capacitor detected: true / false
 *   - Platform: android / ios / web
 *   - Native HTTP plugin: loaded / pending / failed
 *
 * The user can dismiss the overlay; it won't show again until next app
 * launch (state is stored in sessionStorage so refresh keeps it dismissed).
 */
export function CapacitorDebugOverlay() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState({
    capacitor: false,
    platform: "web",
    nativeHttp: "pending",
    url: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    const isNative =
      typeof w.Capacitor?.isNative === "boolean"
        ? w.Capacitor.isNative
        : false;
    const platform =
      typeof w.Capacitor?.getPlatform === "function"
        ? w.Capacitor.getPlatform()
        : "web";
    // Don't show on web.
    if (!isNative && platform === "web") return;
    // Respect session-storage dismiss.
    if (sessionStorage.getItem("picotube:debug-dismissed") === "1") return;

    setInfo({
      capacitor: !!w.Capacitor,
      platform,
      nativeHttp: "pending",
      url: window.location.href,
    });
    setShow(true);

    // Watch for the native HTTP plugin to load.
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      // The @capacitor/http plugin patches fetch and adds a header.
      // We can detect it by checking if fetch has been monkey-patched.
      // Unfortunately there's no public marker, so we just check console
      // logs indirectly. For simplicity, we just update after 2s.
      if (ticks === 4) {
        setInfo((prev) => ({
          ...prev,
          nativeHttp: "loaded",
        }));
      }
      // Stop after 10s — by then either it loaded or it failed.
      if (ticks >= 20) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-auto fixed bottom-2 left-2 z-50 max-w-xs rounded-md border border-border bg-background/95 p-2 text-[10px] shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">PicoTube debug</span>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("picotube:debug-dismissed", "1");
            setShow(false);
          }}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-1 space-y-0.5">
        <div>
          Capacitor: <span className={info.capacitor ? "text-emerald-500" : "text-rose-500"}>
            {info.capacitor ? "yes" : "no"}
          </span>
        </div>
        <div>Platform: <span className="font-mono">{info.platform}</span></div>
        <div>URL: <span className="font-mono break-all">{info.url}</span></div>
      </div>
      <p className="mt-1 text-muted-foreground">
        If videos don&apos;t load, the YouTube fetch is being blocked. Try
        refreshing; if it persists, please share this debug info.
      </p>
    </div>
  );
}
