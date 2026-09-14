"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TradeInput } from "./types";

/**
 * Server actions for the journal.
 * All run with the server-side Supabase client (auth cookies attached),
 * so RLS policies enforce user ownership automatically.
 */

// ────────────────────────────────────────────────────────────────
//  GET — list current user's trades, newest first.
// ────────────────────────────────────────────────────────────────
export async function getTrades(accountId?: string | null): Promise<{
  data?: import("./types").Trade[];
  error?: string;
}> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id);

  if (accountId && accountId !== "all") {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query.order("entry_time", { ascending: false });

  if (error) return { error: error.message };
  return { data: (data ?? []) as import("./types").Trade[] };
}

// ────────────────────────────────────────────────────────────────
//  CREATE
// ────────────────────────────────────────────────────────────────
export async function createTrade(
  input: TradeInput,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Strip nulls to empty so we don't send undefined for optional fields.
  const payload = {
    ...input,
    user_id: user.id,
    // Coerce empty strings to null for numeric columns.
    account_id: input.account_id ?? null,
    exit_price: input.exit_price ?? null,
    stop_loss: input.stop_loss ?? null,
    take_profit: input.take_profit ?? null,
    pnl: input.pnl ?? null,
    r_multiple: input.r_multiple ?? null,
    mae: input.mae ?? null,
    mfe: input.mfe ?? null,
  };

  const { data, error } = await supabase
    .from("trades")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/journal");
  return { id: data.id };
}

// ────────────────────────────────────────────────────────────────
//  UPDATE
// ────────────────────────────────────────────────────────────────
export async function updateTrade(
  id: string,
  updates: Partial<TradeInput>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trades")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id); // belt-and-suspenders with RLS

  if (error) return { error: error.message };

  revalidatePath("/dashboard/journal");
  return {};
}

// ────────────────────────────────────────────────────────────────
//  DELETE
// ────────────────────────────────────────────────────────────────
export async function deleteTrade(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/journal");
  return {};
}
