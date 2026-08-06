/**
 * PicoTube — global client state.
 *
 * Single-page navigation: `view` switches between home, search, and watch.
 * The URL hash is updated so the user can share / refresh and land on the
 * same view.
 *
 * `videoCache` keeps metadata for every video surfaced on home/search so the
 * watch view can render instantly without an extra API call. If a user lands
 * on a watch URL directly (e.g. paste / refresh), the watch view falls back
 * to /api/video/[id].
 */

import { create } from "zustand";
import type { VideoCategory } from "@/lib/youtube-catalog";

export interface VideoMeta {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  category: VideoCategory;
  duration?: string;
  views?: string;
  uploaded?: string;
  thumbnail?: string;
  description?: string;
}

export type View =
  | { kind: "home" }
  | { kind: "search"; query: string }
  | { kind: "watch"; videoId: string };

interface AppState {
  view: View;
  activeCategory: VideoCategory | "All";
  sidebarOpen: boolean;
  videoCache: Record<string, VideoMeta>;
  setView: (v: View) => void;
  setActiveCategory: (c: VideoCategory | "All") => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  cacheVideos: (videos: VideoMeta[]) => void;
  goHome: () => void;
  goSearch: (query: string) => void;
  goWatch: (videoId: string, meta?: VideoMeta) => void;
}

function writeHash(view: View) {
  if (typeof window === "undefined") return;
  if (view.kind === "home") history.replaceState(null, "", "#/");
  else if (view.kind === "search") history.replaceState(null, "", `#/search?q=${encodeURIComponent(view.query)}`);
  else history.replaceState(null, "", `#/watch?v=${view.videoId}`);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function readHash(): View {
  if (typeof window === "undefined") return { kind: "home" };
  const h = window.location.hash.replace(/^#/, "");
  if (h.startsWith("/search")) {
    const q = new URLSearchParams(h.split("?")[1] || "").get("q") || "";
    return { kind: "search", query: q };
  }
  if (h.startsWith("/watch")) {
    const v = new URLSearchParams(h.split("?")[1] || "").get("v") || "";
    if (v) return { kind: "watch", videoId: v };
  }
  return { kind: "home" };
}

export const useAppStore = create<AppState>((set) => ({
  view: typeof window !== "undefined" ? readHash() : { kind: "home" },
  activeCategory: "All",
  sidebarOpen: false,
  videoCache: {},
  setView: (view) => {
    writeHash(view);
    set({ view });
  },
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  cacheVideos: (videos) =>
    set((s) => {
      const next = { ...s.videoCache };
      for (const v of videos) {
        if (!next[v.id]) next[v.id] = v;
      }
      return { videoCache: next };
    }),
  goHome: () => {
    writeHash({ kind: "home" });
    set({ view: { kind: "home" }, activeCategory: "All" });
  },
  goSearch: (query) => {
    writeHash({ kind: "search", query });
    set({ view: { kind: "search", query } });
  },
  goWatch: (videoId, meta) => {
    writeHash({ kind: "watch", videoId });
    set((s) => ({
      view: { kind: "watch", videoId },
      videoCache: meta && !s.videoCache[videoId]
        ? { ...s.videoCache, [videoId]: meta }
        : s.videoCache,
    }));
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    useAppStore.setState({ view: readHash() });
  });
}
