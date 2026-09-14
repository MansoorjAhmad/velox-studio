"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "velox-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {}
  return "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);

    loadFromSupabase().then((serverTheme) => {
      if (serverTheme && serverTheme !== stored) {
        localStorage.setItem(STORAGE_KEY, serverTheme);
        setThemeState(serverTheme);
        applyTheme(serverTheme);
      }
    });
  }, []);

  const setTheme = useCallback(async (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    saveToSupabase(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, isDark: theme === "dark", setTheme, toggleTheme, mounted };
}

async function loadFromSupabase(): Promise<Theme | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("theme_preference")
      .eq("id", user.id)
      .single();
    const pref = data?.theme_preference;
    if (pref === "dark" || pref === "light") return pref;
    return null;
  } catch {
    return null;
  }
}

async function saveToSupabase(theme: Theme): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ theme_preference: theme })
      .eq("id", user.id);
  } catch {}
}
