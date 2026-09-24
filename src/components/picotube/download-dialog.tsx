"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, ExternalLink, Check } from "lucide-react";
import type { VideoMeta } from "@/store/app-store";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: VideoMeta;
}

type Quality = "480p" | "720p" | "1080p";

interface DownloadState {
  status: "idle" | "loading" | "redirect" | "error";
  url?: string;
  error?: string;
}

const QUALITIES: { value: Quality; label: string; size: string }[] = [
  { value: "480p", label: "480p (SD)", size: "~ Small" },
  { value: "720p", label: "720p (HD)", size: "~ Medium" },
  { value: "1080p", label: "1080p (Full HD)", size: "~ Large" },
];

/**
 * DownloadDialog
 *
 * Initiates a download request to our /api/download endpoint, which delegates
 * to a Cobalt-compatible instance (configurable via env on the server) for
 * extracting a direct video stream URL from a YouTube video. The user can
 * pick 480p / 720p / 1080p; on success we open the direct URL in a new tab
 * (browser-triggered .mp4 download) so the file is stored on the device.
 *
 * If the backend is unavailable or the video isn't downloadable (age-restricted,
 * region-locked, removed, etc.) we show the user a friendly message and
 * offer to open the YouTube watch page directly so they can decide how to
 * proceed.
 */
export function DownloadDialog({ open, onOpenChange, video }: DownloadDialogProps) {
  const [quality, setQuality] = useState<Quality>("720p");
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  async function startDownload() {
    setState({ status: "loading" });
    try {
      const data = await apiClient().download({
        url: `https://www.youtube.com/watch?v=${video.id}`,
        quality,
      });
      if (data.status === "redirect" && data.url) {
        setState({ status: "redirect", url: data.url });
        // Trigger browser download in a new tab — the file is delivered
        // directly to the device's Downloads folder.
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else if (data.status === "error" || data.error) {
        throw new Error(data.text || data.error || "Download failed");
      } else {
        throw new Error("Unexpected response from download service");
      }
    } catch (e: any) {
      setState({ status: "error", error: e?.message || "Download failed" });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            Download video
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a quality. The file will be saved to your device&apos;s
            Downloads folder. Only download content you are authorized to
            download.
          </DialogDescription>
        </DialogHeader>

        {state.status === "idle" && (
          <div className="space-y-2">
            <div className="rounded-md bg-accent/40 p-2 text-[11px]">
              <p className="truncate font-medium">{video.title}</p>
              <p className="text-muted-foreground">{video.channel}</p>
            </div>
            <div className="space-y-1.5">
              {QUALITIES.map((q) => (
                <button
                  key={q.value}
                  onClick={() => setQuality(q.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
                    quality === q.value
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        quality === q.value
                          ? "border-rose-500 bg-rose-500 text-white"
                          : "border-border",
                      )}
                    >
                      {quality === q.value && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {q.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {q.size}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            <p className="text-xs text-muted-foreground">
              Preparing {quality} download…
            </p>
          </div>
        )}

        {state.status === "redirect" && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-xs">
              Your download has been opened in a new tab.
            </p>
            <p className="text-[11px] text-muted-foreground">
              If it didn&apos;t start automatically, use the button below.
            </p>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-medium text-background hover:opacity-90"
            >
              <ExternalLink className="h-3 w-3" />
              Open download
            </a>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <p className="text-xs text-foreground">
              Could not prepare the download.
            </p>
            <p className="text-[10px] text-muted-foreground">
              {state.error}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium hover:bg-accent/50"
            >
              <ExternalLink className="h-3 w-3" />
              Open on YouTube
            </a>
          </div>
        )}

        <DialogFooter className="gap-2">
          {state.status === "idle" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={startDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download {quality}
              </Button>
            </>
          )}
          {(state.status === "redirect" || state.status === "error") && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Back
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
