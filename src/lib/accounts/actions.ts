"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TradingAccount, TradingAccountInput } from "./types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getTradingAccounts(): Promise<{
  data?: TradingAccount[];
  error?: string;
}> {
  noStore();
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data: (data ?? []) as TradingAccount[] };
}

export async function createTradingAccount(
  input: TradingAccountInput,
): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("trading_accounts")
    .insert({ ...input, user_id: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { id: data.id };
}

export async function updateTradingAccount(
  id: string,
  updates: Partial<TradingAccountInput>,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trading_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return {};
}

export async function deleteTradingAccount(
  id: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trading_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return {};
}
