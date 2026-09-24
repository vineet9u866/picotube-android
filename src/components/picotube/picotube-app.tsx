"use client";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { HomeView } from "./home-view";
import { SearchView } from "./search-view";
import { WatchView } from "./watch-view";
import { ShortsView } from "./shorts-view";
import { LibraryView, PlaylistView } from "./library-view";
import { useAppStore } from "@/store/app-store";

export function PicoTubeApp() {
  const view = useAppStore((s) => s.view);

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
    </div>
  );
}
