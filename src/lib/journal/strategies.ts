/**
 * Velox Studio — Custom Trading Strategies & Setups Manager.
 * Single source of truth for strategy models across Settings, Trade Form, and Trade List.
 */

import { createClient } from "@/lib/supabase/client";

export const DEFAULT_SETUPS = [
  "TJL 1",
  "TJL 2 (A+)",
  "LEVEL 4",
  "QML",
  "DB / DT",
  "SBR / RBS",
];

const STORAGE_KEY = "velox_custom_strategies";

export function getCustomStrategies(): string[] {
  if (typeof window === "undefined") return DEFAULT_SETUPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETUPS;
    const custom: string[] = JSON.parse(raw);
    return Array.from(new Set([...DEFAULT_SETUPS, ...custom]));
  } catch {
    return DEFAULT_SETUPS;
  }
}

export function addCustomStrategy(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getCustomStrategies();

  const current = getCustomStrategies();
  if (current.includes(trimmed)) return current;

  const updated = [...current, trimmed];
  const customOnly = updated.filter((s) => !DEFAULT_SETUPS.includes(s));

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    window.dispatchEvent(new CustomEvent("velox_strategies_changed"));
  }
  return updated;
}

export function deleteCustomStrategy(name: string): string[] {
  const current = getCustomStrategies();
  const updated = current.filter((s) => s !== name);
  const customOnly = updated.filter((s) => !DEFAULT_SETUPS.includes(s));

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    window.dispatchEvent(new CustomEvent("velox_strategies_changed"));
  }
  return updated;
}

export function subscribeStrategiesListener(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("velox_strategies_changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("velox_strategies_changed", handler);
    window.removeEventListener("storage", handler);
  };
}

/** @deprecated Use subscribeStrategiesListener instead to avoid hook naming collisions */
export const useStrategiesListener = subscribeStrategiesListener;

export async function syncStrategiesFromServer(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getCustomStrategies();
  const { data, error } = await supabase.from("user_strategies").select("name").eq("user_id", user.id);
  if (error || !data) return getCustomStrategies();
  const custom = data.map((strategy) => strategy.name).filter((name) => !DEFAULT_SETUPS.includes(name));
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    window.dispatchEvent(new CustomEvent("velox_strategies_changed"));
  }
  return Array.from(new Set([...DEFAULT_SETUPS, ...custom]));
}

export async function addCustomStrategySynced(name: string): Promise<string[]> {
  const updated = addCustomStrategy(name);
  const trimmed = name.trim();
  if (!trimmed || DEFAULT_SETUPS.includes(trimmed)) return updated;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("user_strategies").upsert({ user_id: user.id, name: trimmed }, { onConflict: "user_id,name", ignoreDuplicates: true });
  return updated;
}

export async function deleteCustomStrategySynced(name: string): Promise<string[]> {
  const updated = deleteCustomStrategy(name);
  if (DEFAULT_SETUPS.includes(name)) return updated;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("user_strategies").delete().eq("user_id", user.id).eq("name", name);
  return updated;
}
