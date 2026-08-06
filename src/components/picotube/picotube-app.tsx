"use client";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { HomeView } from "./home-view";
import { SearchView } from "./search-view";
import { WatchView } from "./watch-view";
import { useAppStore } from "@/store/app-store";

export function PicoTubeApp() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          {view.kind === "home" && <HomeView />}
          {view.kind === "search" && <SearchView query={view.query} />}
          {view.kind === "watch" && <WatchView videoId={view.videoId} />}
        </main>
      </div>
    </div>
  );
}
