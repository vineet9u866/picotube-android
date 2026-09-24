"use client";

import { useState } from "react";
import { useLibraryStore } from "@/store/library-store";
import type { VideoMeta } from "@/store/app-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPlus, Plus, Trash2, Check, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddToPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: VideoMeta;
}

export function AddToPlaylistDialog({
  open,
  onOpenChange,
  video,
}: AddToPlaylistDialogProps) {
  const playlists = useLibraryStore((s) => s.playlists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    const id = createPlaylist(name);
    addToPlaylist(id, video);
    setNewName("");
    setCreating(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ListPlus className="h-4 w-4" />
            Add to playlist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Create new playlist */}
          {creating ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNew();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={submitNew} className="h-8 px-3">
                Create
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Create new playlist
            </button>
          )}

          {/* Existing playlists */}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {playlists.length === 0 && !creating && (
              <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                No playlists yet. Create one above.
              </p>
            )}
            {playlists.map((p) => {
              const inList = p.videos.some((v) => v.id === video.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                    inList ? "bg-rose-600/10 text-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <button
                    onClick={() =>
                      inList
                        ? removeFromPlaylist(p.id, video.id)
                        : addToPlaylist(p.id, video)
                    }
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        inList
                          ? "border-rose-600 bg-rose-600 text-white"
                          : "border-border",
                      )}
                    >
                      {inList && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.videos.length}
                    </span>
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
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
