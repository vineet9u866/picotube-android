/**
 * PicoTube — global client state.
 *
 * Single-page navigation: `view` switches between home, search, and watch.
 * No router is used — the URL hash is updated so the user can share / refresh
 * and land on the same view.
 */

import { create } from "zustand";
import type { VideoCategory } from "@/lib/youtube-catalog";

export type View =
  | { kind: "home" }
  | { kind: "search"; query: string }
  | { kind: "watch"; videoId: string };

interface AppState {
  view: View;
  activeCategory: VideoCategory | "All";
  sidebarOpen: boolean;
  setView: (v: View) => void;
  setActiveCategory: (c: VideoCategory | "All") => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  goHome: () => void;
  goSearch: (query: string) => void;
  goWatch: (videoId: string) => void;
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
  setView: (view) => {
    writeHash(view);
    set({ view });
  },
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  goHome: () => {
    writeHash({ kind: "home" });
    set({ view: { kind: "home" }, activeCategory: "All" });
  },
  goSearch: (query) => {
    writeHash({ kind: "search", query });
    set({ view: { kind: "search", query } });
  },
  goWatch: (videoId) => {
    writeHash({ kind: "watch", videoId });
    set({ view: { kind: "watch", videoId } });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    useAppStore.setState({ view: readHash() });
  });
}
