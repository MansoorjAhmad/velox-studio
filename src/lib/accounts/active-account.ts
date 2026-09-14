import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "velox_active_account_id";

export function getActiveAccountId(): string {
  if (typeof window === "undefined") return "all";
  return localStorage.getItem(STORAGE_KEY) ?? "all";
}

export function setActiveAccountIdLocal(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent("velox_active_account_changed"));
  window.dispatchEvent(new Event("active_account_changed"));
}

export async function syncActiveAccountFromServer(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getActiveAccountId();
  const { data } = await supabase.from("user_preferences").select("active_account_id").eq("user_id", user.id).maybeSingle();
  const id = data?.active_account_id ?? "all";
  setActiveAccountIdLocal(id);
  return id;
}

export async function setActiveAccountIdSynced(id: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        active_account_id: id === "all" ? null : id,
      });
    }
  } catch (err) {
    console.error("Failed to sync active account to Supabase:", err);
  } finally {
    setActiveAccountIdLocal(id);
  }
}
