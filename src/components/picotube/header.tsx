"use client";

import { Menu, Search, X, Youtube, History, Trash2, ChevronRight } from "lucide-react";
import { FormEvent, useRef, useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { useLibraryStore } from "@/store/library-store";
import { apiClient } from "@/lib/api-client";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

interface Suggestion {
  text: string;
  kind: "suggestion" | "history";
}

export function Header() {
  const { goHome, goSearch, toggleSidebar, view } = useAppStore();
  const searchHistory = useLibraryStore((s) => s.searchHistory);
  const recordSearch = useLibraryStore((s) => s.recordSearch);
  const removeFromSearchHistory = useLibraryStore((s) => s.removeFromSearchHistory);
  const clearSearchHistory = useLibraryStore((s) => s.clearSearchHistory);

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Search suggestions state.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = none, -2 = "clear all"

  // Debounced suggestions fetch.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setIsLoadingSuggestions(true);
    const t = setTimeout(async () => {
      try {
        const data = await apiClient().suggestions(trimmed, 8);
        if (!cancelled) setSuggestions(data.suggestions || []);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoadingSuggestions(false);
      }
    }, 120); // 120ms debounce — feels instant but avoids spamming the API.
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Build the dropdown items: matching history first, then suggestions.
  const dropdownItems: Suggestion[] = useMemo(() => {
    const items: Suggestion[] = [];
    const qLower = q.trim().toLowerCase();
    // History matches first (user's own past searches take priority).
    if (qLower.length > 0) {
      for (const h of searchHistory) {
        if (h.query.toLowerCase().includes(qLower)) {
          items.push({ text: h.query, kind: "history" });
        }
        if (items.length >= 4) break;
      }
    } else {
      // No query yet → show recent history at top.
      for (const h of searchHistory.slice(0, 5)) {
        items.push({ text: h.query, kind: "history" });
      }
    }
    // Then suggestions (dedupe against history items).
    const seen = new Set(items.map((i) => i.text.toLowerCase()));
    for (const s of suggestions) {
      if (seen.has(s.toLowerCase())) continue;
      items.push({ text: s, kind: "suggestion" });
      seen.add(s.toLowerCase());
      if (items.length >= 10) break;
    }
    return items;
  }, [q, searchHistory, suggestions]);

  function submit(queryToSubmit: string) {
    const trimmed = (queryToSubmit ?? q).trim();
    if (!trimmed) return;
    recordSearch(trimmed);
    goSearch(trimmed);
    setShowDropdown(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function submitForm(e: FormEvent) {
    e.preventDefault();
    submit(q);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = dropdownItems.length + (searchHistory.length > 0 ? 1 : 0); // +1 for "Delete all"
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
      setShowDropdown(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < dropdownItems.length) {
        e.preventDefault();
        submit(dropdownItems[activeIndex].text);
      } else if (activeIndex === dropdownItems.length && searchHistory.length > 0) {
        e.preventDefault();
        clearSearchHistory();
        setActiveIndex(-1);
      } else {
        submitForm(e);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
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

      <form
        onSubmit={submitForm}
        className="relative ml-2 flex flex-1 items-center justify-center"
        ref={containerRef}
      >
        <div className="flex w-full max-w-xl items-center">
          <div className="flex h-7 w-full items-center rounded-l-full border border-r-0 border-border bg-input/50 px-3 focus-within:border-rose-500/60 focus-within:bg-background transition-colors">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowDropdown(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={onKeyDown}
              type="text"
              placeholder="Search videos"
              className="h-full w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              aria-label="Search videos"
              autoComplete="off"
              spellCheck={false}
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                  setShowDropdown(true);
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

        {/* Search suggestions dropdown */}
        {showDropdown && (dropdownItems.length > 0 || searchHistory.length > 0) && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background shadow-lg"
            style={{ maxWidth: "max(640px, 90vw)" }}
          >
            {dropdownItems.map((item, idx) => (
              <button
                key={`${item.kind}-${item.text}-${idx}`}
                type="button"
                onClick={() => submit(item.text)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                  activeIndex === idx ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {item.kind === "history" ? (
                  <History className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{item.text}</span>
                {item.kind === "history" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromSearchHistory(item.text);
                    }}
                    aria-label="Delete from history"
                    className="text-muted-foreground hover:text-rose-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}

            {searchHistory.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearSearchHistory();
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(dropdownItems.length)}
                className={cn(
                  "flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-[11px] text-muted-foreground",
                  activeIndex === dropdownItems.length
                    ? "bg-accent"
                    : "hover:bg-accent/50",
                )}
              >
                <Trash2 className="h-3 w-3 shrink-0" />
                Delete all search history
              </button>
            )}
          </div>
        )}
      </form>

      <ThemeToggle className="shrink-0" />
    </header>
  );
}
