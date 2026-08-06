"use client";

import { Menu, Search, X, Youtube } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export function Header() {
  const { goHome, goSearch, toggleSidebar, view } = useAppStore();
  const [q, setQ] = useState("");
  // Track the last view.query we synced from. Adjust state during render
  // (React-recommended) instead of using an effect to avoid cascading renders.
  const [prevViewQuery, setPrevViewQuery] = useState(
    view.kind === "search" ? view.query : "",
  );
  if (view.kind === "search" && view.query !== prevViewQuery) {
    setPrevViewQuery(view.query);
    setQ(view.query);
  }

  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) goSearch(trimmed);
  }

  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-border bg-background/90 px-2 backdrop-blur sm:px-3">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={toggleSidebar}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={goHome}
        className="flex shrink-0 items-center gap-1.5"
        aria-label="PicoTube home"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600">
          <Youtube className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="hidden text-sm font-bold tracking-tight sm:inline">
          Pico<span className="text-rose-500">Tube</span>
        </span>
      </button>

      <form onSubmit={submit} className="ml-2 flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-xl items-center">
          <div className="flex h-7 w-full items-center rounded-l-full border border-r-0 border-border bg-input/50 px-3 focus-within:border-rose-500/60 focus-within:bg-background transition-colors">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="text"
              placeholder="Search videos"
              className="h-full w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              aria-label="Search videos"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            aria-label="Search"
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-r-full border border-border bg-accent px-3",
              "hover:bg-accent/70 transition-colors",
            )}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      <ThemeToggle className="shrink-0" />
    </header>
  );
}
