"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getDebts, createDebt, updateDebtPayment, deleteDebt } from "@/lib/finances/actions";
import type { Debt } from "@/lib/finances/types";
import {
  CreditCard,
  Plus,
  Trash2,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  Zap,
  Calendar,
  Flame,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<Debt["type"]>("credit_card");
  const [totalAmount, setTotalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getDebts();
    if (res.error) setError(res.error);
    setDebts(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const totalDebt = debts.reduce((sum, d) => sum + Number(d.total_amount ?? d.balance ?? 0), 0);
    const totalPaid = debts.reduce((sum, d) => sum + Number(d.paid_amount ?? 0), 0);
    const remaining = Math.max(0, totalDebt - totalPaid);
    const pctPaid = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 100;

    // Monthly interest calculation
    const monthlyInterest = debts.reduce((sum, d) => {
      const rem = Math.max(0, Number(d.total_amount ?? d.balance ?? 0) - Number(d.paid_amount ?? 0));
      const rate = d.interest_rate ? Number(d.interest_rate) / 100 / 12 : 0;
      return sum + rem * rate;
    }, 0);

    return { totalDebt, totalPaid, remaining, pctPaid, monthlyInterest };
  }, [debts]);

  const sortedDebts = useMemo(() => {
    const list = [...debts];
    if (strategy === "avalanche") {
      // Highest interest rate first
      return list.sort((a, b) => Number(b.interest_rate ?? 0) - Number(a.interest_rate ?? 0));
    } else {
      // Lowest balance first (Snowball)
      return list.sort((a, b) => {
        const remA = Number(a.total_amount ?? a.balance ?? 0) - Number(a.paid_amount ?? 0);
        const remB = Number(b.total_amount ?? b.balance ?? 0) - Number(b.paid_amount ?? 0);
        return remA - remB;
      });
    }
  }, [debts, strategy]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !totalAmount) return;

    setSaving(true);
    const amt = parseFloat(totalAmount);
    const res = await createDebt({
      name: name.trim(),
      balance: amt,
      total_amount: amt,
      type,
      paid_amount: 0,
      interest_rate: interestRate ? parseFloat(interestRate) : null,
      min_payment: minPayment ? parseFloat(minPayment) : null,
    });

    setSaving(false);
    if (res.error) setError(res.error);
    else {
      setShowAddModal(false);
      setName("");
      setTotalAmount("");
      setInterestRate("");
      setMinPayment("");
      await load();
    }
  };

  const handlePayOff = async (debt: Debt, addAmount: number) => {
    const newPaid = Math.min(Number(debt.total_amount), Number(debt.paid_amount) + addAmount);
    await updateDebtPayment(debt.id, newPaid);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteDebt(id);
    await load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Debt Freedom Engine</h1>
            <p className="text-sm text-foreground-muted">
              Strategic debt payoff analytics (Snowball vs Avalanche engine).
            </p>
          </div>
        </div>
        <a href="/dashboard/finances?tab=debts">
          <Button variant="outline" size="sm">
            <CreditCard className="w-4 h-4" />
            Manage Debts
          </Button>
        </a>
      </div>

      {/* Progress Hero */}
      <Card className="border-brand/20 bg-brand/5">
        <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <h2 className="text-base font-bold">Total Debt Payoff Progress</h2>
            </div>
            <p className="text-xs text-foreground-muted">
              {formatCurrency(totals.totalPaid)} Paid · {formatCurrency(totals.remaining)} Remaining Total
            </p>
          </div>

          <div className="w-full md:w-72 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-profit">{totals.pctPaid}% Paid Off</span>
              <span className="text-foreground-subtle">{formatCurrency(totals.remaining)} Left</span>
            </div>
            <div className="h-3 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-profit transition-all duration-500"
                style={{ width: `${totals.pctPaid}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Engine Switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
            Optimization Engine:
          </span>
          <div className="flex items-center rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setStrategy("avalanche")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                strategy === "avalanche" ? "bg-brand text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              Avalanche (Save Interest)
            </button>
            <button
              onClick={() => setStrategy("snowball")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                strategy === "snowball" ? "bg-brand text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              <Flame className="w-3.5 h-3.5" />
              Snowball (Quick Wins)
            </button>
          </div>
        </div>

        <div className="text-xs font-mono text-foreground-subtle bg-surface px-3 py-1.5 rounded-lg border border-border">
          Monthly Interest Cost: <span className="text-loss font-bold">${totals.monthlyInterest.toFixed(2)}/mo</span>
        </div>
      </div>

      {/* Debts List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sortedDebts.length === 0 ? (
        <Card className="py-12 text-center border-dashed">
          <CardContent className="space-y-2">
            <CreditCard className="w-8 h-8 text-foreground-subtle mx-auto" />
            <p className="text-sm font-medium text-foreground-muted">Zero Debts! You are 100% debt free 🎉</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedDebts.map((debt, index) => {
            const rem = Math.max(0, Number(debt.total_amount) - Number(debt.paid_amount));
            const pct = Math.min(100, Math.round((Number(debt.paid_amount) / Number(debt.total_amount)) * 100));

            return (
              <Card key={debt.id} className="relative group hover:border-brand/40 transition-all">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">{debt.name}</h3>
                        {debt.interest_rate && (
                          <Badge variant="warning" className="text-[9px]">
                            {debt.interest_rate}% APR
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {(debt.type ?? "loan").replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground-subtle mt-0.5 font-mono">
                        Remaining: <span className="text-foreground font-bold">{formatCurrency(rem)}</span> of {formatCurrency(Number(debt.total_amount))}
                      </p>
                    </div>
                  </div>

                  {/* Progress & Quick Payment */}
                  <div className="flex items-center gap-4">
                    <div className="w-40 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="text-profit">{pct}% Paid</span>
                        <span className="text-foreground-subtle">{formatCurrency(rem)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full bg-profit transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => handlePayOff(debt, 100)}>
                        + $100
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handlePayOff(debt, 500)}>
                        + $500
                      </Button>
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                        title="Delete Debt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Debt Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Debt Target">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted">Debt Name *</label>
            <Input placeholder="e.g. Credit Card 1, Car Loan" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground-muted">Debt Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Debt["type"])}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none"
              >
                <option value="credit_card">Credit Card</option>
                <option value="loan">Personal Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground-muted">Total Balance ($) *</label>
              <Input type="number" step="0.01" placeholder="5000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground-muted">Interest Rate (% APR)</label>
              <Input type="number" step="0.1" placeholder="18.5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground-muted">Min Monthly Payment ($)</label>
              <Input type="number" step="0.01" placeholder="150" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              Add Debt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
