"use client";

import { useAppStore } from "@/store/app-store";
import { CATEGORIES, type VideoCategory } from "@/lib/youtube-catalog";
import { cn } from "@/lib/utils";
import { useRef } from "react";

export function CategoryChips() {
  const { activeCategory, setActiveCategory, view, goSearch, setView } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const all = ["All", ...CATEGORIES] as (VideoCategory | "All")[];

  function pick(cat: VideoCategory | "All") {
    setActiveCategory(cat);
    if (view.kind === "search") {
      goSearch(view.query || "");
    } else {
      // Stay on home view but keep the new category — do NOT call goHome
      // because goHome resets the category to "All".
      setView({ kind: "home" });
    }
  }

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar sticky top-11 z-20 flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur sm:px-3"
      style={{ scrollbarWidth: "none" }}
    >
      {all.map((cat) => {
        const active = activeCategory === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => pick(cat)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "bg-accent text-foreground hover:bg-accent/70",
            )}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
