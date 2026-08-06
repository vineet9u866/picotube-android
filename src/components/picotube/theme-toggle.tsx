"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      suppressHydrationWarning
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${className || ""}`}
    >
      {/* Render both icons; CSS shows the right one based on html.dark class */}
      <Sun className="hidden h-3.5 w-3.5 dark:block" />
      <Moon className="block h-3.5 w-3.5 dark:hidden" />
    </button>
  );
}
