"use client";

import {
  Home, Music, Cpu, Gamepad2, FlaskRound, GraduationCap, Laugh,
  Plane, UtensilsCrossed, Trophy, Clapperboard, Radio, Newspaper,
  X, Play, Github,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { CATEGORIES, type VideoCategory } from "@/lib/youtube-catalog";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const ICONS: Record<VideoCategory, typeof Home> = {
  Music,
  Tech: Cpu,
  Gaming: Gamepad2,
  Science: FlaskRound,
  Education: GraduationCap,
  Comedy: Laugh,
  Travel: Plane,
  Cooking: UtensilsCrossed,
  Sports: Trophy,
  Trailers: Clapperboard,
  Live: Radio,
  News: Newspaper,
};

export function Sidebar() {
  const { sidebarOpen, setSidebar, activeCategory, setActiveCategory, goHome, view, goSearch, setView } = useAppStore();

  // Close sidebar on view change (mobile UX)
  useEffect(() => {
    setSidebar(false);
  }, [view, setSidebar]);

  function pickCategory(cat: VideoCategory | "All") {
    setActiveCategory(cat);
    if (view.kind === "search") {
      goSearch(view.query || "");
    } else {
      // Preserve the new category — do not call goHome (it resets category).
      setView({ kind: "home" });
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebar(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-11 z-40 h-[calc(100vh-2.75rem)] w-48 shrink-0 overflow-y-auto border-r border-border bg-background transition-transform md:sticky md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between px-3 py-2 md:hidden">
          <span className="text-xs font-semibold">Menu</span>
          <button
            type="button"
            onClick={() => setSidebar(false)}
            aria-label="Close sidebar"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="px-1.5 py-2">
          <button
            type="button"
            onClick={() => { setActiveCategory("All"); goHome(); }}
            className={cn(
              "mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs",
              "hover:bg-accent transition-colors",
              activeCategory === "All" && view.kind === "home" && "bg-accent font-medium",
            )}
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </button>

          <div className="my-2 h-px bg-border" />

          <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Categories
          </div>

          {CATEGORIES.map((cat) => {
            const Icon = ICONS[cat];
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => pickCategory(cat)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs",
                  "hover:bg-accent transition-colors",
                  active && "bg-accent font-medium text-rose-600 dark:text-rose-400",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat}
              </button>
            );
          })}

          <div className="my-2 h-px bg-border" />

          <button
            type="button"
            onClick={() => pickCategory("All")}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs",
              "hover:bg-accent transition-colors",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            All videos
          </button>

          <div className="my-2 h-px bg-border" />

          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs",
              "hover:bg-accent transition-colors text-muted-foreground",
            )}
          >
            <Github className="h-3.5 w-3.5" />
            Powered by YouTube API
          </a>
        </nav>

        <div className="px-3 py-3 text-[10px] leading-relaxed text-muted-foreground">
          PicoTube &middot; minimal streaming
          <br />
          No accounts &middot; No ads
        </div>
      </aside>
    </>
  );
}
