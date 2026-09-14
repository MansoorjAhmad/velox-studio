"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RoutineCategory = "deen" | "life" | "trading" | "work" | "growth";

export interface RoutineItem {
  id: string;
  title: string;
  time_slot: string | null;
  category: RoutineCategory;
  sort_order: number;
}

export interface RoutineLog {
  id: string;
  item_id: string | null;
  category: RoutineCategory;
  log_date: string; // YYYY-MM-DD
  created_at: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ════════════════════════════════════════════════════════════════
//  ROUTINE ITEMS (habit definitions)
// ════════════════════════════════════════════════════════════════

export async function getRoutineItems(): Promise<{
  data?: RoutineItem[];
  error?: string;
}> {
  noStore();
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("routine_items")
    .select("id, title, time_slot, category, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message };
  return { data: (data ?? []) as RoutineItem[] };
}

export async function createRoutineItem(input: {
  title: string;
  time_slot?: string;
  category: RoutineCategory;
  sort_order?: number;
}): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("routine_items")
    .insert({
      user_id: user.id,
      title: input.title,
      time_slot: input.time_slot ?? null,
      category: input.category,
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/routine");
  return { id: data.id };
}

export async function updateRoutineItem(
  id: string,
  updates: Partial<Pick<RoutineItem, "title" | "time_slot" | "category" | "sort_order">>,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("routine_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/routine");
  return {};
}

export async function deleteRoutineItem(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("routine_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/routine");
  return {};
}

/** Seed a user's routine from a template (only if they have zero items). */
export async function seedRoutineIfEmpty(
  template: { title: string; time_slot: string; category: RoutineCategory }[],
): Promise<{ error?: string; seeded?: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { count } = await supabase
    .from("routine_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) return { seeded: false };

  const rows = template.map((t, i) => ({
    user_id: user.id,
    title: t.title,
    time_slot: t.time_slot,
    category: t.category,
    sort_order: i,
  }));

  const { error } = await supabase.from("routine_items").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/routine");
  return { seeded: true };
}

// ════════════════════════════════════════════════════════════════
//  ROUTINE LOGS (daily completions)
// ════════════════════════════════════════════════════════════════

export async function getRoutineLogs(days = 60): Promise<{
  data?: RoutineLog[];
  error?: string;
}> {
  noStore();
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("routine_logs")
    .select("id, item_id, category, log_date, created_at")
    .eq("user_id", user.id)
    .gte("log_date", since.toISOString().split("T")[0])
    .order("log_date", { ascending: false });

  if (error) return { error: error.message };
  return { data: (data ?? []) as RoutineLog[] };
}

/** Toggle a habit completion for today (or a specific date). */
export async function toggleRoutineLog(
  itemId: string,
  category: RoutineCategory,
  date?: string,
): Promise<{ completed?: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const logDate = date ?? new Date().toISOString().split("T")[0];

  // Check if already logged today
  const { data: existing } = await supabase
    .from("routine_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (existing) {
    // Un-complete: remove the log
    const { error } = await supabase
      .from("routine_logs")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/routine");
    return { completed: false };
  }

  // Complete: insert log
  const { error } = await supabase.from("routine_logs").insert({
    user_id: user.id,
    item_id: itemId,
    category,
    log_date: logDate,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/routine");
  return { completed: true };
}
