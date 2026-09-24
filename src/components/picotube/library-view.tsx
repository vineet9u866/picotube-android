"use client";

import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { VideoGrid } from "./video-grid";
import { VideoCard } from "./video-card";
import type { VideoMeta } from "@/store/app-store";
import {
  Bookmark,
  ThumbsUp,
  History as HistoryIcon,
  ListVideo,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertCircle,
  Play,
  Clock,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export function LibraryView({
  section,
}: {
  section: "playlists" | "saved" | "liked" | "history";
}) {
  if (section === "playlists") return <PlaylistsSection />;
  if (section === "saved") return <SavedSection />;
  if (section === "liked") return <LikedSection />;
  return <HistorySection />;
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: typeof Bookmark;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600/10 text-rose-600 dark:text-rose-400">
          <Icon className="h-4 w-4" />
        </span>
        <h1 className="text-sm font-bold">{title}</h1>
        {count != null && count > 0 && (
          <span className="text-[11px] text-muted-foreground">
            &middot; {count} {count === 1 ? "item" : "items"}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Bookmark;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PlaylistsSection() {
  const playlists = useLibraryStore((s) => s.playlists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const goPlaylist = useAppStore((s) => s.goPlaylist);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    const id = createPlaylist(name);
    setNewName("");
    setCreating(false);
    goPlaylist(id);
  }

  return (
    <div className="px-2 py-3 sm:px-3">
      <SectionHeader
        icon={ListVideo}
        title="Playlists"
        count={playlists.length}
        action={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-rose-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New playlist
          </button>
        }
      />

      {creating && (
        <div className="mb-3 flex gap-2 rounded-md border border-border p-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Playlist name"
            className="h-7 flex-1 rounded border border-border bg-input/30 px-2 text-xs outline-none focus:border-rose-500/60"
          />
          <button
            onClick={submitNew}
            className="rounded bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {playlists.length === 0 && !creating ? (
        <EmptyState
          icon={ListVideo}
          title="No playlists yet"
          subtitle="Create playlists to organize your favorite videos. Click the + button on any video to add it to a playlist."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {playlists.map((p) => {
            const first = p.videos[0];
            const isRenaming = renamingId === p.id;
            return (
              <div
                key={p.id}
                className="group flex flex-col rounded-md border border-border p-1 hover:bg-accent/30 transition-colors"
              >
                <button
                  onClick={() => goPlaylist(p.id)}
                  className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-rose-500/20 to-rose-700/30"
                >
                  {first?.thumbnail ? (
                    <img
                      src={first.thumbnail}
                      alt={p.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-50"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white">
                    <Play className="h-4 w-4 translate-x-px fill-white" />
                  </span>
                  <span className="absolute bottom-1 right-1 z-10 rounded bg-black/80 px-1 py-px text-[10px] font-medium text-white">
                    {p.videos.length}
                  </span>
                </button>
                {isRenaming ? (
                  <div className="mt-1.5 flex items-center gap-1 px-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renamePlaylist(p.id, renameValue);
                          setRenamingId(null);
                        }
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-6 flex-1 rounded border border-border bg-input/30 px-1.5 text-[11px] outline-none focus:border-rose-500/60"
                    />
                    <button
                      onClick={() => {
                        renamePlaylist(p.id, renameValue);
                        setRenamingId(null);
                      }}
                      className="text-emerald-500"
                      aria-label="Confirm rename"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1 px-1">
                    <p className="flex-1 truncate text-xs font-medium">{p.name}</p>
                    <button
                      onClick={() => {
                        setRenamingId(p.id);
                        setRenameValue(p.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete playlist "${p.name}"? This cannot be undone.`,
                          )
                        ) {
                          deletePlaylist(p.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SavedSection() {
  const saved = useLibraryStore((s) => s.saved);
  const goWatch = useAppStore((s) => s.goWatch);

  return (
    <div className="px-2 py-3 sm:px-3">
      <SectionHeader icon={Bookmark} title="Saved videos" count={saved.length} />
      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          subtitle="Tap the Save button under any video to keep it here for later."
        />
      ) : (
        <VideoGrid videos={saved as VideoMeta[]} />
      )}
    </div>
  );
}

function LikedSection() {
  const liked = useLibraryStore((s) => s.liked);
  return (
    <div className="px-2 py-3 sm:px-3">
      <SectionHeader icon={ThumbsUp} title="Liked videos" count={liked.length} />
      {liked.length === 0 ? (
        <EmptyState
          icon={ThumbsUp}
          title="Nothing liked yet"
          subtitle="Tap the Like button under any video to find it here."
        />
      ) : (
        <VideoGrid videos={liked as VideoMeta[]} />
      )}
    </div>
  );
}

function HistorySection() {
  const history = useLibraryStore((s) => s.history);
  const removeFromHistory = useLibraryStore((s) => s.removeFromHistory);
  const clearHistory = useLibraryStore((s) => s.clearHistory);
  const goWatch = useAppStore((s) => s.goWatch);

  // Sort by watchedAt descending — newest first.
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.watchedAt - a.watchedAt),
    [history],
  );

  return (
    <div className="px-2 py-3 sm:px-3">
      <SectionHeader
        icon={HistoryIcon}
        title="Watch history"
        count={sorted.length}
        action={
          sorted.length > 0 ? (
            <button
              onClick={() => {
                if (confirm("Clear all watch history? This cannot be undone.")) {
                  clearHistory();
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium hover:bg-accent/50"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          ) : null
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No watch history yet"
          subtitle="Videos you watch will appear here so you can resume them later."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sorted.map((h) => {
            const v = h.video;
            const watchedAt = new Date(h.watchedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const resumeLabel =
              h.positionSec && h.durationSec
                ? `Resume at ${formatTime(h.positionSec)} / ${formatTime(h.durationSec)}`
                : "Watch again";
            return (
              <div key={v.id} className="group relative">
                <button
                  onClick={() => goWatch(v.id, v)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    {/* Progress bar — shows resume position */}
                    {h.positionPct != null && h.positionPct > 0 && h.positionPct < 0.95 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                        <div
                          className="h-full bg-rose-600"
                          style={{ width: `${Math.min(100, Math.max(0, h.positionPct * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <h3 className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {v.title}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {v.channel}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {watchedAt}
                  </p>
                  <p className="text-[10px] text-rose-500 dark:text-rose-400">
                    {resumeLabel}
                  </p>
                </button>
                <button
                  onClick={() => removeFromHistory(v.id)}
                  className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                  aria-label="Remove from history"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const playlists = useLibraryStore((s) => s.playlists);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const goWatch = useAppStore((s) => s.goWatch);
  const goLibrary = useAppStore((s) => s.goLibrary);

  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-muted-foreground">Playlist not found.</p>
        <button
          onClick={() => goLibrary("playlists")}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          Back to playlists
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 py-3 sm:px-3">
      <SectionHeader
        icon={ListVideo}
        title={playlist.name}
        count={playlist.videos.length}
        action={
          <button
            onClick={() => goLibrary("playlists")}
            className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium hover:bg-accent/50"
          >
            All playlists
          </button>
        }
      />
      {playlist.videos.length === 0 ? (
        <EmptyState
          icon={ListVideo}
          title="This playlist is empty"
          subtitle="Browse videos and tap the + button to add them to this playlist."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {playlist.videos.map((v) => (
            <div key={v.id} className="group relative">
              <VideoCard video={v} />
              <button
                onClick={() => removeFromPlaylist(playlist.id, v.id)}
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                aria-label="Remove from playlist"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
