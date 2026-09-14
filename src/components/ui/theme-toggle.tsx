"use client";

import { useTheme } from "@/lib/theme/use-theme";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Prevent hydration mismatch — render a placeholder until mounted
  if (!mounted) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-center",
          size === "sm" ? "w-8 h-8" : "w-9 h-9",
          className,
        )}
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-center",
        "text-foreground-subtle hover:text-foreground hover:border-brand/40 hover:bg-surface-2",
        "transition-all shadow-2xs group",
        size === "sm" ? "w-8 h-8" : "w-9 h-9",
        className,
      )}
      title={isDark ? "Switch to Light Mode (Parchment)" : "Switch to Dark Mode (Obsidian)"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {/* Sun — visible in dark mode */}
      <Sun
        className={cn(
          "absolute transition-all duration-300 group-hover:scale-110",
          size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75",
        )}
      />
      {/* Moon — visible in light mode */}
      <Moon
        className={cn(
          "absolute transition-all duration-300 group-hover:scale-110",
          size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
          isDark ? "opacity-0 -rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
        )}
      />
    </button>
  );
}
