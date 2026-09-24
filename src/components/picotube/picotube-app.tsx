"use client";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { HomeView } from "./home-view";
import { SearchView } from "./search-view";
import { WatchView } from "./watch-view";
import { ShortsView } from "./shorts-view";
import { LibraryView, PlaylistView } from "./library-view";
import { CapacitorDebugOverlay } from "./debug-overlay";
import { useAppStore } from "@/store/app-store";
import { useEffect } from "react";

/**
 * PicoTubeApp — top-level component.
 *
 * Renders the right view based on the URL hash (home / search / watch /
 * shorts / library / playlist).
 *
 * Capacitor back-button handling: when running inside the Android APK
 * (detected via window.Capacitor), we subscribe to the App plugin's
 * `backButton` event so the hardware back button navigates back through
 * the in-app views (watch → search → home → exit) instead of immediately
 * exiting the app.
 */
export function PicoTubeApp() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const setView = useAppStore((s) => s.setView);
  const setSidebar = useAppStore((s) => s.setSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  // Capacitor back-button subscription — only runs in the Android APK
  // (window.Capacitor is defined by the native shell).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (!w.Capacitor?.Plugins?.App) return;

    let listener: { remove: () => void } | undefined;
    (async () => {
      try {
        const AppPlugin = w.Capacitor.Plugins.App;
        listener = await AppPlugin.addListener(
          "backButton",
          ({ canGoBack }: { canGoBack: boolean }) => {
            // 1. If the sidebar is open, close it (don't navigate).
            if (useAppStore.getState().sidebarOpen) {
              setSidebar(false);
              return;
            }
            // 2. If we're in a sub-view (search / watch / shorts / library
            //    / playlist), go home instead of exiting.
            const v = useAppStore.getState().view;
            if (v.kind !== "home") {
              goHome();
              return;
            }
            // 3. If we're already home, exit the app.
            w.Capacitor.Plugins.App.exitApp();
          },
        );
      } catch {
        // ignore — not running in Capacitor
      }
    })();

    return () => {
      listener?.remove?.().catch(() => {});
    };
  }, [goHome, setSidebar, setView]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <div className="flex flex-1">
        {view.kind !== "shorts" && <Sidebar />}
        <main
          className={
            view.kind === "shorts"
              ? "min-w-0 flex-1"
              : "min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]"
          }
        >
          {view.kind === "home" && <HomeView />}
          {view.kind === "search" && <SearchView query={view.query} />}
          {view.kind === "watch" && <WatchView videoId={view.videoId} />}
          {view.kind === "shorts" && <ShortsView />}
          {view.kind === "library" && <LibraryView section={view.section} />}
          {view.kind === "playlist" && <PlaylistView playlistId={view.playlistId} />}
        </main>
      </div>
      <CapacitorDebugOverlay />
    </div>
  );
}
