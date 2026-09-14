"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionInput, DebtInput } from "./types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ════════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════════════

export interface GetTransactionsOptions {
  startDate?: string;
  limit?: number;
  type?: "income" | "expense";
}

export async function getTransactions(options?: GetTransactionsOptions): Promise<{
  data?: import("./types").Transaction[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id);

  if (options?.startDate) {
    query = query.gte("date", options.startDate);
  }
  if (options?.type) {
    query = query.eq("type", options.type);
  }

  query = query.order("date", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) return { error: error.message };
  return { data: (data ?? []) as import("./types").Transaction[] };
}

export async function createTransaction(
  input: TransactionInput,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .insert({ ...input, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finances");
  return {};
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finances");
  return {};
}

// ════════════════════════════════════════════════════════════════
//  DEBTS
// ════════════════════════════════════════════════════════════════

export async function getDebts(): Promise<{
  data?: import("./types").Debt[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .order("balance", { ascending: false });

  if (error) return { error: error.message };
  return { data: (data ?? []) as import("./types").Debt[] };
}

export async function createDebt(
  input: DebtInput,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("debts")
    .insert({ ...input, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finances");
  return {};
}

export async function updateDebt(
  id: string,
  updates: Partial<DebtInput & { is_paid_off: boolean }>,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("debts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finances");
  return {};
}

export async function deleteDebt(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finances");
  return {};
}

export async function logDebtPayment(
  debtId: string,
  amount: number,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated" };

  // Insert the payment record.
  const { error: payErr } = await supabase.from("debt_payments").insert({
    debt_id: debtId,
    user_id: user.id,
    amount,
  });
  if (payErr) return { error: payErr.message };

  // Fetch current balance, then reduce it.
  const { data: debt, error: fetchErr } = await supabase
    .from("debts")
    .select("balance")
    .eq("id", debtId)
    .single();
  if (fetchErr) return { error: fetchErr.message };

  const newBalance = Math.max(0, debt.balance - amount);
  const { error: updErr } = await supabase
    .from("debts")
    .update({
      balance: newBalance,
      is_paid_off: newBalance === 0,
    })
    .eq("id", debtId);

  if (updErr) return { error: updErr.message };
  revalidatePath("/dashboard/finances");
  revalidatePath("/dashboard/debts");
  return {};
}

export async function updateDebtPayment(
  debtId: string,
  paidAmount: number,
): Promise<{ error?: string }> {
  return updateDebt(debtId, { paid_amount: paidAmount });
}
