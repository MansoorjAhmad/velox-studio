"use server";

import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/journal/types";

export interface ZenithData {
  trades: Trade[];
  error?: string;
}

export async function getZenithData(accountId?: string | null): Promise<ZenithData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { trades: [], error: "Not authenticated" };

  let query = supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id);

  if (accountId && accountId !== "all") {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query.order("entry_time", { ascending: false });

  if (error) return { trades: [], error: error.message };
  return { trades: (data ?? []) as Trade[] };
}
