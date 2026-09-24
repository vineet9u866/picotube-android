"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ThemeProvider } from "./theme-provider";

/**
 * Capacitor native HTTP patch.
 *
 * In Capacitor 6, HTTP support is built into `@capacitor/core` as the
 * `CapacitorHttp` API. We enable it via `capacitor.config.ts` and then
 * patch `window.fetch` here so cross-origin requests (e.g. to
 * youtube.com) route through the native HTTP bridge (bypassing CORS).
 *
 * Without this, the WebView can't fetch YouTube HTML pages (YouTube
 * doesn't send CORS headers) and the home page shows "Could not load
 * videos" inside the APK.
 *
 * This must be called inside the `Providers` function component because
 * it uses the `useEffect` hook. (Previous bug: we called it at the top
 * level of the module, which threw "Invalid hook call".)
 */
function useCapacitorNativeHttp() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (!w.Capacitor) return; // not in Capacitor — skip

    // isNative check (boolean, not function — see api-client.ts)
    let isNative = false;
    if (typeof w.Capacitor.isNative === "boolean") isNative = w.Capacitor.isNative;
    else if (typeof w.Capacitor.getPlatform === "function") {
      try { isNative = w.Capacitor.getPlatform() !== "web"; } catch {}
    }
    if (!isNative) return;

    // Patch window.fetch to route cross-origin requests through the
    // native CapacitorHttp bridge (bypasses CORS). We only patch once.
    if (w.Capacitor._picotubeHttpPatched) return;
    w.Capacitor._picotubeHttpPatched = true;

    const originalFetch = w.fetch.bind(w);
    w.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      // Same-origin requests (e.g. /api/*) → use original fetch.
      if (url && (url.startsWith("/") || url.startsWith(w.location.origin))) {
        return originalFetch(input, init);
      }

      // Cross-origin requests → route through CapacitorHttp if available.
      // The native HTTP bridge isn't subject to CORS.
      try {
        // Capacitor 6: CapacitorHttp is exposed via window.Capacitor.Plugins
        // when enabled in capacitor.config.ts.
        const Http = w.Capacitor.Plugins?.CapacitorHttp
          || w.Capacitor.Plugins?.Http;
        if (Http && typeof Http.request === "function") {
          const method = (init?.method || "GET").toUpperCase();
          const headers: Record<string, string> = {};
          if (init?.headers) {
            const h = init.headers;
            if (h instanceof Headers) {
              h.forEach((v: string, k: string) => { headers[k] = v; });
            } else if (Array.isArray(h)) {
              for (const [k, v] of h) headers[k] = String(v);
            } else {
              for (const k in h) headers[k] = String((h as any)[k]);
            }
          }
          const response = await Http.request({
            url,
            method,
            headers,
            data: init?.body,
            responseType: "arraybuffer",
          });
          // Convert the native response to a standard Response.
          const body = typeof response.data === "string"
            ? response.data
            : new TextEncoder().encode(String(response.data || ""));
          const responseInit: ResponseInit = {
            status: response.status || 200,
            headers: response.headers || {},
          };
          return new Response(body, responseInit);
        }
      } catch (e) {
        // If the native HTTP bridge throws, fall through to the
        // original fetch (which will likely fail with a CORS error,
        // but at least we'll see the real error in the console).
        // eslint-disable-next-line no-console
        console.warn("[PicoTube] CapacitorHttp failed, falling back to fetch:", e);
      }

      return originalFetch(input, init);
    };

    // eslint-disable-next-line no-console
    console.log("[PicoTube] Native HTTP patch applied — cross-origin fetch() now bypasses CORS");
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Apply the native HTTP patch (no-op on web; routes cross-origin
  // through CapacitorHttp on Android).
  useCapacitorNativeHttp();

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
