/**
 * PicoTube — Library state (Playlists, Saved, Liked, History).
 *
 * Persisted to localStorage via zustand/middleware persist so the user
 * keeps their library across sessions. Keys are namespaced `picotube:*`
 * to avoid colliding with anything else on the origin.
 *
 * Each entry stores a full VideoMeta snapshot — when a video is removed
 * from YouTube's catalog we can still render it in the library.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VideoMeta } from "./app-store";

export interface PlaylistEntry {
  id: string; // unique playlist id (uuid)
  name: string;
  createdAt: number;
  videos: VideoMeta[];
}

export interface HistoryEntry {
  video: VideoMeta;
  watchedAt: number; // epoch ms
  positionPct?: number; // 0..1 playback position for resume-watching
  positionSec?: number; // seconds
  durationSec?: number; // seconds
}

export interface SearchHistoryEntry {
  query: string;
  at: number;
}

interface LibraryState {
  playlists: PlaylistEntry[];
  saved: VideoMeta[];
  liked: VideoMeta[];
  history: HistoryEntry[];
  searchHistory: SearchHistoryEntry[];

  // Playlists
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, video: VideoMeta) => void;
  removeFromPlaylist: (id: string, videoId: string) => void;
  isInPlaylist: (id: string, videoId: string) => boolean;

  // Saved
  toggleSave: (video: VideoMeta) => void;
  isSaved: (videoId: string) => boolean;

  // Liked
  toggleLike: (video: VideoMeta) => void;
  isLiked: (videoId: string) => boolean;

  // History
  recordWatch: (video: VideoMeta, positionSec?: number, durationSec?: number, positionPct?: number) => void;
  removeFromHistory: (videoId: string) => void;
  clearHistory: () => void;

  // Search history
  recordSearch: (query: string) => void;
  removeFromSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

function genId(): string {
  // Avoid importing uuid to keep this module side-effect-free.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      playlists: [],
      saved: [],
      liked: [],
      history: [],
      searchHistory: [],

      // ── Playlists ───────────────────────────────────────────────────────
      createPlaylist: (name) => {
        const id = genId();
        const entry: PlaylistEntry = {
          id,
          name: name.trim() || "New playlist",
          createdAt: Date.now(),
          videos: [],
        };
        set((s) => ({ playlists: [...s.playlists, entry] }));
        return id;
      },

      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p,
          ),
        })),

      deletePlaylist: (id) =>
        set((s) => ({
          playlists: s.playlists.filter((p) => p.id !== id),
        })),

      addToPlaylist: (id, video) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id
              ? {
                  ...p,
                  videos: p.videos.some((v) => v.id === video.id)
                    ? p.videos
                    : [...p.videos, video],
                }
              : p,
          ),
        })),

      removeFromPlaylist: (id, videoId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id
              ? { ...p, videos: p.videos.filter((v) => v.id !== videoId) }
              : p,
          ),
        })),

      isInPlaylist: (id, videoId) => {
        const p = get().playlists.find((x) => x.id === id);
        return !!p && p.videos.some((v) => v.id === videoId);
      },

      // ── Saved ───────────────────────────────────────────────────────────
      toggleSave: (video) =>
        set((s) => {
          const exists = s.saved.some((v) => v.id === video.id);
          return {
            saved: exists
              ? s.saved.filter((v) => v.id !== video.id)
              : [video, ...s.saved],
          };
        }),
      isSaved: (videoId) => get().saved.some((v) => v.id === videoId),

      // ── Liked ────────────────────────────────────────────────────────────
      toggleLike: (video) =>
        set((s) => {
          const exists = s.liked.some((v) => v.id === video.id);
          return {
            liked: exists
              ? s.liked.filter((v) => v.id !== video.id)
              : [video, ...s.liked],
          };
        }),
      isLiked: (videoId) => get().liked.some((v) => v.id === videoId),

      // ── Watch history ──────────────────────────────────────────────────
      recordWatch: (video, positionSec, durationSec, positionPct) =>
        set((s) => {
          const entry: HistoryEntry = {
            video,
            watchedAt: Date.now(),
            positionSec,
            durationSec,
            positionPct,
          };
          // Move to top, dedupe by id.
          const without = s.history.filter((h) => h.video.id !== video.id);
          return { history: [entry, ...without].slice(0, 500) };
        }),

      removeFromHistory: (videoId) =>
        set((s) => ({
          history: s.history.filter((h) => h.video.id !== videoId),
        })),

      clearHistory: () => set({ history: [] }),

      // ── Search history ─────────────────────────────────────────────────
      recordSearch: (query) =>
        set((s) => {
          const trimmed = query.trim();
          if (!trimmed) return {};
          const without = s.searchHistory.filter(
            (h) => h.query.toLowerCase() !== trimmed.toLowerCase(),
          );
          return {
            searchHistory: [
              { query: trimmed, at: Date.now() },
              ...without,
            ].slice(0, 100),
          };
        }),

      removeFromSearchHistory: (query) =>
        set((s) => ({
          searchHistory: s.searchHistory.filter((h) => h.query !== query),
        })),

      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: "picotube:library",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR-safe stub: never persist on the server.
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      // Only persist the data, not the action functions.
      partialize: (s) => ({
        playlists: s.playlists,
        saved: s.saved,
        liked: s.liked,
        history: s.history,
        searchHistory: s.searchHistory,
      }),
      version: 1,
    },
  ),
);
