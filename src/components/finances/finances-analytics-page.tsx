"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getTransactions } from "@/lib/finances/actions";
import type { Transaction } from "@/lib/finances/types";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Activity,
  Wallet,
  PieChart,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export function FinancesAnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"30D" | "90D" | "ALL">("90D");

  useEffect(() => {
    let active = true;
    async function fetchFiltered() {
      setLoading(true);
      setError(null);
      const days = timeframe === "30D" ? 30 : timeframe === "90D" ? 90 : null;
      const startDate = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : undefined;
      const res = await getTransactions({ startDate });
      if (active) {
        if (res.error) setError(res.error);
        setTransactions(res.data ?? []);
        setLoading(false);
      }
    }
    fetchFiltered();
    return () => {
      active = false;
    };
  }, [timeframe]);

  const filtered = transactions;

  const stats = useMemo(() => {
    const incomeTx = filtered.filter((t) => t.type === "income");
    const expenseTx = filtered.filter((t) => t.type === "expense");

    const totalIncome = incomeTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = expenseTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const netCashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashflow / totalIncome) * 100)) : 0;

    const catMap = new Map<string, number>();
    for (const t of expenseTx) {
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
    }
    const categories = Array.from(catMap.entries())
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        pct: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const incomeCats = new Map<string, number>();
    for (const t of incomeTx) {
      incomeCats.set(t.category, (incomeCats.get(t.category) ?? 0) + Number(t.amount));
    }
    const incomeBreakdown = Array.from(incomeCats.entries())
      .map(([cat, amt]) => ({ category: cat, amount: amt }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly trend (last 6 months)
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const t of filtered) {
      const key = t.date.slice(0, 7);
      const ex = monthlyMap.get(key) ?? { income: 0, expense: 0 };
      if (t.type === "income") ex.income += Number(t.amount);
      else ex.expense += Number(t.amount);
      monthlyMap.set(key, ex);
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, d]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        income: d.income,
        expense: d.expense,
        net: d.income - d.expense,
      }));

    // Rolling 30-day net
    const dailyNet: { date: string; net: number; cumulative: number }[] = [];
    const dayMap = new Map<string, number>();
    for (const t of filtered) {
      const sign = t.type === "income" ? 1 : -1;
      dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + sign * Number(t.amount));
    }
    const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    for (const [date, net] of sortedDays) {
      cumulative += net;
      dailyNet.push({ date, net, cumulative });
    }

    const avgMonthlyIncome = monthlyTrend.length > 0
      ? monthlyTrend.reduce((s, m) => s + m.income, 0) / monthlyTrend.length
      : 0;
    const avgMonthlyExpense = monthlyTrend.length > 0
      ? monthlyTrend.reduce((s, m) => s + m.expense, 0) / monthlyTrend.length
      : 0;

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      savingsRate,
      categories,
      incomeBreakdown,
      monthlyTrend,
      dailyNet,
      avgMonthlyIncome,
      avgMonthlyExpense,
      txCount: filtered.length,
    };
  }, [filtered]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finances Analytics</h1>
            <p className="text-sm text-foreground-muted">
              Cashflow velocity, savings rate, category intelligence &amp; monthly trends.
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
          {(["30D", "90D", "ALL"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-md transition-all",
                timeframe === tf ? "bg-brand text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-loss/30">
          <CardContent className="py-3 text-sm text-loss">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Income", value: `+${formatCurrency(stats.totalIncome)}`, color: "text-profit", icon: ArrowUpRight },
              { label: "Total Expenses", value: `-${formatCurrency(stats.totalExpenses)}`, color: "text-loss", icon: ArrowDownRight },
              { label: "Net Cashflow", value: `${stats.netCashflow >= 0 ? "+" : ""}${formatCurrency(stats.netCashflow)}`, color: stats.netCashflow >= 0 ? "text-profit" : "text-loss", icon: DollarSign },
              { label: "Savings Rate", value: `${stats.savingsRate}%`, color: "text-brand", icon: ShieldCheck },
              { label: "Avg Monthly In", value: `+${formatCurrency(stats.avgMonthlyIncome)}`, color: "text-emerald-400", icon: Wallet },
              { label: "Transactions", value: `${stats.txCount}`, color: "text-foreground", icon: Activity },
            ].map((kpi) => (
              <Card key={kpi.label} className="card-hover">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <kpi.icon className="w-3 h-3 text-foreground-subtle" />
                    <span className="text-[9px] text-foreground-subtle uppercase tracking-wider font-bold">{kpi.label}</span>
                  </div>
                  <p className={cn("text-lg font-extrabold font-mono tabular", kpi.color)}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand" />
                  Income vs Expense Trend
                </CardTitle>
                <CardDescription>Monthly cashflow comparison over time.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                {stats.monthlyTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-border rounded-lg">
                    <p className="text-xs text-foreground-subtle">Log transactions in Finances to unlock charts.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px", fontSize: "11px" }} />
                      <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} name="Income" />
                      <Bar dataKey="expense" fill="#fb7185" radius={[4, 4, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5 card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  Cumulative Net Cashflow
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                {stats.dailyNet.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-border rounded-lg">
                    <p className="text-xs text-foreground-subtle">No transaction history yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.dailyNet}>
                      <defs>
                        <linearGradient id="finCumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--foreground-subtle)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
                      <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: "10px", fontSize: "11px", color: "var(--foreground)" }} formatter={(v) => [formatCurrency(Number(v)), "Cumulative"]} />
                      <Area type="monotone" dataKey="cumulative" stroke="var(--brand)" strokeWidth={2} fill="url(#finCumGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-loss" />
                  Expense Category Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.categories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-foreground-subtle border border-dashed rounded-lg">No expenses logged.</div>
                ) : (
                  stats.categories.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{c.category}</span>
                        <span className="font-mono text-loss">{formatCurrency(c.amount)} ({c.pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-loss/80 to-loss rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-profit" />
                  Income Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.incomeBreakdown.length === 0 ? (
                  <div className="py-8 text-center text-xs text-foreground-subtle border border-dashed rounded-lg">No income logged.</div>
                ) : (
                  stats.incomeBreakdown.map((c) => {
                    const pct = stats.totalIncome > 0 ? Math.round((c.amount / stats.totalIncome) * 100) : 0;
                    return (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{c.category}</span>
                          <span className="font-mono text-profit">{formatCurrency(c.amount)} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-profit/80 to-profit rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="card-hover border-brand/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand" />
                Capital Efficiency Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-2">
                  <p className="text-xs font-bold text-brand">Savings Rate</p>
                  <p className="text-3xl font-extrabold font-mono text-brand">{stats.savingsRate}%</p>
                  <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand to-profit" style={{ width: `${stats.savingsRate}%` }} />
                  </div>
                  <p className="text-[10px] text-foreground-muted">{stats.savingsRate >= 50 ? "Ultra capital preservation ⚡" : "Target: 50%+ retention"}</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface-2/40">
                  <p className="text-[10px] uppercase text-foreground-subtle font-bold">Income Retained</p>
                  <p className="text-2xl font-bold font-mono text-profit mt-1">{formatCurrency(Math.max(0, stats.netCashflow))}</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface-2/40">
                  <p className="text-[10px] uppercase text-foreground-subtle font-bold">Outflow Ratio</p>
                  <p className="text-2xl font-bold font-mono text-loss mt-1">
                    {stats.totalIncome > 0 ? ((stats.totalExpenses / stats.totalIncome) * 100).toFixed(0) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
