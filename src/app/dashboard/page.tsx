"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getTrades } from "@/lib/journal/actions";
import { getTradingAccounts } from "@/lib/accounts/actions";
import {
  calculateMetrics,
  calculateDrawdown,
  currentStreak,
  buildEquityCurve,
  breakdownBySetup,
  breakdownBySession,
  buildRMultipleBuckets,
  buildCalendar,
  calculateTradingScore,
} from "@/lib/journal/metrics";
import { calculateDisciplineScore } from "@/lib/routine/score";
import { getRoutineItems, getRoutineLogs } from "@/lib/routine/actions";
import { calculateSystemQuality } from "@/lib/journal/system-quality";
import { calculateTraderIndex } from "@/lib/journal/trader-index";
import { getTradingConfig, syncTradingConfigFromServer } from "@/lib/trading-config";
import { getActiveAccountId, setActiveAccountIdSynced, syncActiveAccountFromServer } from "@/lib/accounts/active-account";
import { TradingCalendarWidget } from "@/components/dashboard/trading-calendar-widget";
import { TraderIndexGauge } from "@/components/dashboard/trader-index-gauge";
import { PerformanceSnapshotWidget } from "@/components/dashboard/performance-snapshot-widget";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Target,
  Sparkles,
  Flame,
  Zap,
  ArrowUpRight,
  Shield,
  Globe,
  Award,
  Activity,
  Clock,
  Layers,
  Loader2,
} from "lucide-react";
import { PageTransition } from "@/components/ui/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import type { Trade } from "@/lib/journal/types";
import type { TradingAccount } from "@/lib/accounts/types";
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
  ReferenceLine,
} from "recharts";

export default function DashboardPage() {
  const supabase = createClient();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccId, setActiveAccId] = useState<string>("all");
  // initialLoad = true only on first mount — shows skeleton
  // After first data arrives, we keep stale data visible on refetch
  const [initialLoad, setInitialLoad] = useState(true);
  const [accountSwitching, setAccountSwitching] = useState(false);
  const [tradingConfig, setTradingConfig] = useState(getTradingConfig);
  const [routineItemsCount, setRoutineItemsCount] = useState(0);
  const [routineOverallPct, setRoutineOverallPct] = useState(0);
  const [routineStreak, setRoutineStreak] = useState(0);

  const load = useCallback(async () => {
    const savedAccId = getActiveAccountId();
    setActiveAccId(savedAccId);

    // Single parallel fetch — all 5 data sources fire simultaneously
    const [result, accountsResult, routineItemsRes, routineLogsRes] = await Promise.all([
      getTrades(savedAccId),
      getTradingAccounts(),
      getRoutineItems(),
      getRoutineLogs(),
    ]);

    setAccounts(accountsResult.data ?? []);

    if (!result.error) {
      setTrades(result.data ?? []);
    }

    const rItems = routineItemsRes.data ?? [];
    const rLogs = routineLogsRes.data ?? [];
    setRoutineItemsCount(rItems.length);

    if (rItems.length > 0) {
      const totalSlots = rItems.length * 30;
      const completedCount = rLogs.length;
      const pct = Math.min(100, Math.round((completedCount / (totalSlots || 1)) * 100));
      setRoutineOverallPct(pct);

      const logDates = new Set(rLogs.map((l) => l.log_date));
      let curStreak = 0;
      const d = new Date();
      for (let i = 0; i < 30; i++) {
        const key = d.toISOString().split("T")[0];
        if (logDates.has(key)) curStreak++;
        else break;
        d.setDate(d.getDate() - 1);
      }
      setRoutineStreak(curStreak);
    }

    setInitialLoad(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    syncTradingConfigFromServer();
    syncActiveAccountFromServer();
    async function init() {
      await load();
      if (active) {
        setTradingConfig(getTradingConfig());
      }
    }
    init();

    const handleAccChange = async () => {
      setAccountSwitching(true);
      await load();
      setAccountSwitching(false);
    };
    const handleConfigChange = () => setTradingConfig(getTradingConfig());
    window.addEventListener("active_account_changed", handleAccChange);
    window.addEventListener("trading_config_changed", handleConfigChange);
    return () => {
      active = false;
      window.removeEventListener("active_account_changed", handleAccChange);
      window.removeEventListener("trading_config_changed", handleConfigChange);
    };
  }, [load]);

  const metrics = calculateMetrics(trades);
  const tradingScore = useMemo(() => calculateTradingScore(metrics), [metrics]);
  const disciplineScore = useMemo(
    () => calculateDisciplineScore(routineOverallPct, routineStreak),
    [routineOverallPct, routineStreak]
  );
  const activeBalance = useMemo(() => {
    if (activeAccId !== "all") return accounts.find((account) => account.id === activeAccId)?.initial_balance ?? 10000;
    return accounts.length > 0 ? accounts.reduce((sum, account) => sum + Number(account.initial_balance || 0), 0) : 10000;
  }, [accounts, activeAccId]);
  const drawdown = useMemo(() => calculateDrawdown(trades, activeBalance), [trades, activeBalance]);
  const streak = currentStreak(trades);
  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades]);
  const systemQuality = useMemo(() => calculateSystemQuality(trades), [trades]);
  const traderIndex = useMemo(() => calculateTraderIndex(trades, tradingConfig), [trades, tradingConfig]);
  const setupBreakdown = useMemo(() => breakdownBySetup(trades), [trades]);
  const sessionBreakdown = useMemo(() => breakdownBySession(trades), [trades]);

  const currentSession = useMemo(() => {
    const h = new Date().getUTCHours();
    if (h >= 0 && h < 8) return { name: "Asian Session", emoji: "🌏", color: "text-warning", bg: "bg-warning/10 border-warning/30" };
    if (h >= 8 && h < 14) return { name: "London Session", emoji: "🇬🇧", color: "text-info", bg: "bg-info/10 border-info/30" };
    return { name: "New York Session", emoji: "🇺🇸", color: "text-brand", bg: "bg-brand/10 border-brand/30" };
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTrades = useMemo(() => trades.filter((t) => t.entry_time?.startsWith(todayStr)), [trades, todayStr]);
  const todayPnl = useMemo(() => todayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0), [todayTrades]);
  const todayWins = useMemo(() => todayTrades.filter((t) => (t.pnl ?? 0) > 0).length, [todayTrades]);
  const todayWinRate = todayTrades.length > 0 ? (todayWins / todayTrades.length) * 100 : 0;

  const currentMonthStr = todayStr.slice(0, 7);
  const monthTrades = useMemo(() => trades.filter((t) => t.entry_time?.startsWith(currentMonthStr)), [trades, currentMonthStr]);
  const monthPnl = useMemo(() => monthTrades.reduce((s, t) => s + (t.pnl ?? 0), 0), [monthTrades]);
  const monthlyTarget = tradingConfig.monthlyProfitTarget;
  const monthTargetPct = Math.min(100, Math.max(0, Math.round((monthPnl / monthlyTarget) * 100)));
  const monthRunway = useMemo(() => {
    const now = new Date();
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
    const remaining = Math.max(0, monthlyTarget - monthPnl);
    return { remaining, daysLeft, requiredDaily: remaining / daysLeft };
  }, [monthlyTarget, monthPnl]);

  const strategyBreakdown = useMemo(() => {
    return setupBreakdown.map((s) => {
      const closed = trades.filter((t) => t.setup === s.key && t.status === "closed");
      const seq = closed
        .sort((a, b) => new Date(a.exit_time ?? a.entry_time).getTime() - new Date(b.exit_time ?? b.entry_time).getTime())
        .slice(-6)
        .map((t) => (t.pnl ?? 0) > 0);
      return {
        setup: s.key,
        total: s.trades,
        wins: Math.round(s.winRate * s.trades),
        winRate: Math.round(s.winRate * 100),
        pnl: s.netPnl,
        seq,
      };
    });
  }, [setupBreakdown, trades]);

  const calendarPnlMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (!t.entry_time) continue;
      const day = t.entry_time.split("T")[0];
      map.set(day, (map.get(day) ?? 0) + (t.pnl ?? 0));
    }
    return map;
  }, [trades]);

  const bestDayPnl = useMemo(() => {
    let max = 0;
    for (const v of calendarPnlMap.values()) if (v > max) max = v;
    return max;
  }, [calendarPnlMap]);

  const topAsset = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) if (t.symbol) map.set(t.symbol, (map.get(t.symbol) ?? 0) + (t.pnl ?? 0));
    let top = "—";
    let mx = -Infinity;
    for (const [s, p] of map) if (p > mx) { mx = p; top = s; }
    return top;
  }, [trades]);

  const topStrategy = strategyBreakdown.length > 0 ? strategyBreakdown[0].setup : "—";

  const dailyRiskUsed = useMemo(() => {
    const lossesToday = todayTrades
      .filter((t) => (t.pnl ?? 0) < 0)
      .reduce((s, t) => s + Math.abs(t.pnl ?? 0), 0);
    return Math.min(tradingConfig.dailyRiskLimitPct, (lossesToday / activeBalance) * 100);
  }, [todayTrades, activeBalance, tradingConfig.dailyRiskLimitPct]);

  const recentTrades = useMemo(
    () =>
      [...trades]
        .filter((t) => t.status === "closed")
        .sort((a, b) => new Date(b.exit_time ?? b.entry_time).getTime() - new Date(a.exit_time ?? a.entry_time).getTime())
        .slice(0, 5),
    [trades],
  );

  const rBuckets = useMemo(() => buildRMultipleBuckets(trades), [trades]);

  const weeklyVelocity = useMemo(() => {
    const days: { label: string; pnl: number; trades: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayTrades = trades.filter((t) => t.entry_time?.startsWith(key));
      days.push({
        label,
        pnl: dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0),
        trades: dayTrades.length,
      });
    }
    return days;
  }, [trades]);

  const confluenceEdge = useMemo(() => {
    const map = new Map<string, { trades: number; wins: number; pnl: number }>();
    for (const t of trades) {
      if (t.status !== "closed" || t.pnl == null || !t.confluences?.length) continue;
      for (const c of t.confluences) {
        const ex = map.get(c) ?? { trades: 0, wins: 0, pnl: 0 };
        map.set(c, {
          trades: ex.trades + 1,
          wins: ex.wins + (t.pnl > 0 ? 1 : 0),
          pnl: ex.pnl + t.pnl,
        });
      }
    }
    return Array.from(map.entries())
      .map(([tag, d]) => ({ tag, ...d, winRate: d.trades > 0 ? (d.wins / d.trades) * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [trades]);

  const calendarMap = useMemo(() => buildCalendar(trades), [trades]);
  const greenDayStreak = useMemo(() => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const key = d.toISOString().split("T")[0];
      const day = calendarMap.get(key);
      if (!day) break;
      if (day.pnl > 0) streak++;
      else break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [calendarMap]);

  if (initialLoad) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-5 h-52" />
          <Skeleton className="lg:col-span-3 h-52" />
          <Skeleton className="lg:col-span-4 h-52" />
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6 relative">
      {accountSwitching && <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-brand" /></div>}

      {/* Account Filter Sync Banner */}
      {activeAccId !== "all" && (
        (() => {
          const activeAcc = accounts.find((a) => a.id === activeAccId);
          return (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-brand/25 bg-brand/10 backdrop-blur-md animate-fade-in text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeAcc?.color || "var(--brand)" }} />
                <span className="font-semibold text-foreground">
                  Showing stats for: <span className="text-brand font-bold">{activeAcc ? activeAcc.name : "Selected Account"}</span>
                  {activeAcc && ` (${activeAcc.account_type.toUpperCase()} · Initial: ${formatCurrency(activeAcc.initial_balance)})`}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveAccountIdSynced("all");
                }}
                className="text-[10px] text-foreground-subtle hover:text-foreground underline font-mono"
              >
                Reset to All Accounts
              </button>
            </div>
          );
        })()
      )}

      {/* Decision layer */}
      <Card className="glass-subtle card-hover">
        <CardContent className="p-4 md:p-5 relative">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-profit" />
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-foreground-subtle">Execution intelligence</span>
              </div>
              <p className="text-lg font-bold tracking-tight">Your next decision has a context.</p>
              <p className="text-xs text-foreground-muted mt-1">Read the constraint before you read the chart.</p>
            </div>
            <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-border/80 bg-background/40 p-3">
                <p className="text-[9px] uppercase tracking-wider text-foreground-subtle font-bold">Risk capacity</p>
                <p className={cn("font-mono text-lg font-extrabold mt-1", dailyRiskUsed >= tradingConfig.dailyRiskLimitPct * .66 ? "text-loss" : "text-profit")}>
                  {Math.max(0, tradingConfig.dailyRiskLimitPct - dailyRiskUsed).toFixed(1)}%
                </p>
                <p className="text-[9px] text-foreground-muted">remaining today</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/40 p-3">
                <p className="text-[9px] uppercase tracking-wider text-foreground-subtle font-bold">Target runway</p>
                <p className="font-mono text-lg font-extrabold mt-1 text-brand">{formatCurrency(monthRunway.requiredDaily)}</p>
                <p className="text-[9px] text-foreground-muted">per day · {monthRunway.daysLeft}d left</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/40 p-3">
                <p className="text-[9px] uppercase tracking-wider text-foreground-subtle font-bold">System state</p>
                <p className={cn("font-mono text-lg font-extrabold mt-1", systemQuality.overall >= 70 ? "text-profit" : "text-warning")}>{systemQuality.overall}/100</p>
                <p className="text-[9px] text-foreground-muted">quality score</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Snapshot Widget — Trading & Discipline Scores */}
      <PerformanceSnapshotWidget
        tradingScore={tradingScore}
        disciplineScore={disciplineScore}
        hasTrades={metrics.closedTrades > 0}
        hasRoutine={routineItemsCount > 0}
      />

      {/* Empty State Banner if 0 Trades Logged */}
      {trades.length === 0 && (
        <Card className="border-dashed border-2 border-border bg-surface/50 p-6 md:p-8 text-center animate-fade-in">
          <div className="max-w-md mx-auto space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h3 className="text-xl font-display font-semibold text-foreground">Welcome to Your Trading Command Center</h3>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Log your first execution to activate institutional Net P&amp;L telemetry, R-multiples, the Trader Index discipline matrix, and Zenith AI forensics.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/dashboard/journal">
                <Button size="sm" className="font-semibold text-xs gap-1.5 bg-foreground text-background hover:bg-foreground/90">
                  <DollarSign className="w-3.5 h-3.5" /> Log First Trade
                </Button>
              </Link>
              <Link href="/dashboard/accounts">
                <Button size="sm" variant="outline" className="text-xs font-medium">
                  Configure Accounts
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Primary KPI Metric Hierarchy: Executive Hero Dominance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* The ONE number that matters most — visually commanding hero card */}
        <Card className="lg:col-span-7 border-border bg-surface relative overflow-hidden flex flex-col justify-between shadow-xs card-hover">
          <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-brand/5 blur-2xl pointer-events-none" />
          <CardContent className="p-6 md:p-7 flex flex-col justify-between h-full space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-subtle">
                    {activeAccId === "all" ? "Portfolio Net Realized P&L" : "Account Net Realized P&L"}
                  </span>
                </div>
                <Badge variant={metrics.netPnl >= 0 ? "profit" : "loss"} className="text-[10px] font-mono font-bold px-2 py-0.5">
                  {metrics.netPnl >= 0 ? "+" : ""}{activeBalance > 0 ? ((metrics.netPnl / activeBalance) * 100).toFixed(2) : "0.00"}% ROI
                </Badge>
              </div>

              {/* Dominant Figure */}
              <div className="mt-3">
                <div className={cn(
                  "font-display font-medium text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none",
                  metrics.netPnl >= 0 ? "text-profit" : "text-loss"
                )}>
                  {metrics.netPnl >= 0 ? "+" : ""}<AnimatedCounter value={metrics.netPnl} format="currency" />
                </div>
                <p className="text-xs text-foreground-muted mt-2 font-mono flex items-center gap-2">
                  <span>Current Capital Basis:</span>
                  <strong className="text-foreground">{formatCurrency(activeBalance + metrics.netPnl)}</strong>
                  <span className="text-border">|</span>
                  <span>{metrics.closedTrades} closed positions</span>
                </p>
              </div>
            </div>

            {/* Session Context & Win-Loss Ratio Bar */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-foreground-subtle">Today:</span>
                  <span className={cn("font-bold", todayPnl >= 0 ? "text-profit" : "text-loss")}>
                    {todayPnl >= 0 ? "+" : ""}{formatCurrency(todayPnl)}
                  </span>
                  <span className="text-foreground-subtle">({todayTrades.length} trades)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground-subtle">Win Ratio:</span>
                  <span className="font-bold text-foreground">{(metrics.winRate * 100).toFixed(1)}%</span>
                  <span className="text-foreground-subtle">({metrics.wins}W / {metrics.losses}L)</span>
                </div>
              </div>

              {/* Visual Win/Loss Segment Bar */}
              <div className="h-2 w-full rounded-full bg-surface-3 flex overflow-hidden">
                <div
                  className="h-full bg-profit transition-all duration-700 rounded-l-full"
                  style={{ width: `${metrics.closedTrades > 0 ? (metrics.wins / metrics.closedTrades) * 100 : 50}%` }}
                />
                <div
                  className="h-full bg-loss transition-all duration-700 rounded-r-full"
                  style={{ width: `${metrics.closedTrades > 0 ? (metrics.losses / metrics.closedTrades) * 100 : 50}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Secondary KPIs Companion Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          {/* Profit Factor */}
          <Card className="card-hover border-border bg-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-foreground-subtle" /> Profit Factor
                </span>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded",
                  metrics.profitFactor >= 2 ? "bg-profit/15 text-profit" : metrics.profitFactor >= 1.2 ? "bg-brand/15 text-brand" : "bg-surface-2 text-foreground-muted"
                )}>
                  {metrics.profitFactor >= 2 ? "Elite" : metrics.profitFactor >= 1.2 ? "Viable" : "Under 1.2"}
                </span>
              </div>
              <div className="font-display font-medium text-2xl text-foreground mt-1.5">
                {metrics.profitFactor === Infinity ? "∞" : <AnimatedCounter value={metrics.profitFactor} format="decimal" decimals={2} />}
              </div>
            </div>
            <p className="text-[10px] text-foreground-muted font-mono mt-2">
              Gross Win / Gross Loss ratio
            </p>
          </Card>

          {/* Max Drawdown */}
          <Card className="card-hover border-border bg-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-foreground-subtle" /> Max Drawdown
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-loss/15 text-loss font-mono">
                  -{(drawdown.maxDrawdownPct * 100).toFixed(1)}%
                </span>
              </div>
              <div className="font-display font-medium text-2xl text-loss mt-1.5">
                -<AnimatedCounter value={drawdown.maxDrawdown} format="currency" />
              </div>
            </div>
            <p className="text-[10px] text-foreground-muted font-mono mt-2">
              Deepest valley from peak
            </p>
          </Card>

          {/* Monthly Target Runway */}
          <Card className="card-hover border-border bg-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-foreground-subtle" /> Monthly Target
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-foreground font-mono">
                  {monthTargetPct}%
                </span>
              </div>
              <div className={cn("font-display font-medium text-2xl mt-1.5", monthPnl >= 0 ? "text-profit" : "text-loss")}>
                {monthPnl >= 0 ? "+" : ""}<AnimatedCounter value={monthPnl} format="currency" />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full bg-profit rounded-full transition-all duration-700" style={{ width: `${monthTargetPct}%` }} />
              </div>
              <p className="text-[10px] text-foreground-muted font-mono">
                {monthRunway.daysLeft}d remaining in cycle
              </p>
            </div>
          </Card>

          {/* Current Streak */}
          <Card className="card-hover border-border bg-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-foreground-subtle" /> Current Run
                </span>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono",
                  streak.type === "win" ? "bg-profit/15 text-profit" : streak.type === "loss" ? "bg-loss/15 text-loss" : "bg-surface-2 text-foreground-muted"
                )}>
                  {streak.type === "win" ? "Win Streak" : streak.type === "loss" ? "Drawdown" : "Neutral"}
                </span>
              </div>
              <div className="font-display font-medium text-2xl text-foreground mt-1.5 flex items-center gap-1.5">
                <AnimatedCounter value={streak.count} format="number" />
                <span className="text-xs font-normal text-foreground-subtle">consecutive</span>
              </div>
            </div>
            <p className="text-[10px] text-foreground-muted font-mono mt-2">
              {streak.type === "win" ? "Discipline compound 🔥" : streak.type === "loss" ? "Watch tilt limits" : "Standby"}
            </p>
          </Card>
        </div>
      </div>

      {/* Weekly Velocity + R-Multiple + Confluence Edge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" />
              7-Day Velocity
            </CardTitle>
            <CardDescription>Daily P&amp;L pulse · {greenDayStreak > 0 ? `${greenDayStreak}-day green streak 🔥` : "Build momentum"}</CardDescription>
          </CardHeader>
          <CardContent className="h-48 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVelocity} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)", radius: 4 }}
                  content={<ChartTooltip
                    labelFormatter={(l) => String(l)}
                    formatter={(val) => [formatCurrency(Number(val)), "P&L"]}
                    colorBySign
                  />}
                />
                <Bar dataKey="pnl" radius={[6, 6, 2, 2]}>
                  {weeklyVelocity.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.pnl >= 0 ? "#34d399" : "#fb7185"}
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-brand" />
              R-Multiple Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {rBuckets.every((b) => b.count === 0) ? (
              <EmptyState
                icon={Target}
                title="No R-Multiples yet"
                description="Add R values to your trades to see distribution."
                size="sm"
              />
            ) : (
              rBuckets.map((b) => {
                const max = Math.max(...rBuckets.map((x) => x.count), 1);
                const isLoss = b.label.includes("-");
                return (
                  <div key={b.label} className="flex items-center gap-2 text-[10px]">
                    <span className="w-16 font-mono text-foreground-subtle shrink-0">{b.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", isLoss ? "bg-loss/70" : "bg-profit/80")}
                        style={{ width: `${(b.count / max) * 100}%` }}
                      />
                    </div>
                    <span className={cn("w-4 font-mono font-bold", isLoss ? "text-loss" : "text-profit")}>{b.count}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" />
              Confluence Edge Matrix
            </CardTitle>
            <CardDescription>Top performing confluence tags from trade log.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {confluenceEdge.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No confluence data"
                description="Tag FVG, Liquidity Sweep, Fib on trades to unlock edge matrix."
                size="sm"
              />
            ) : (
              confluenceEdge.map((c) => (
                <div key={c.tag} className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface-2/30 text-xs">
                  <Badge variant="outline" className="text-[9px]">{c.tag}</Badge>
                  <div className="flex items-center gap-2 font-mono font-bold">
                    <span className="text-brand">{c.winRate.toFixed(0)}%</span>
                    <span className={c.pnl >= 0 ? "text-profit" : "text-loss"}>
                      {c.pnl >= 0 ? "+" : ""}{formatCurrency(c.pnl)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve — Hero visual */}
      <Card className="card-hover border-brand/15 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-brand/5 blur-3xl pointer-events-none" />
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand" />
              Cumulative Equity Curve
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">Expectancy <AnimatedCounter value={metrics.expectancy} format="currency" className="ml-1" />/trade</Badge>
              <Badge variant="brand" className="text-[10px] animate-pulse">● Live</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-2 relative">
          {equityCurve.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No equity curve yet"
              description="Close your first trade to start building your equity curve."
              action={{ label: "Log a trade", href: "/dashboard/journal" }}
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="dashEqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="60%" stopColor="var(--brand)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={56} />
                {monthlyTarget > 0 && (
                  <ReferenceLine
                    y={monthlyTarget}
                    stroke="var(--profit)"
                    strokeDasharray="4 4"
                    label={{ value: `Target: $${monthlyTarget}`, fill: "var(--profit)", fontSize: 10, position: "top" }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: "var(--brand)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={<ChartTooltip
                    labelFormatter={(l) => `Trade ${l}`}
                    formatter={(val) => [formatCurrency(Number(val)), "Cumulative P&L"]}
                    colorBySign
                  />}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#dashEqGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--brand)", stroke: "var(--surface)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Trader Index (discipline) + Strategy + Session */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <TraderIndexGauge breakdown={traderIndex.breakdown} />
        </div>

        <Card className="lg:col-span-5 card-hover">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                Strategy Performance &amp; Playbooks
              </CardTitle>
              <CardDescription>Win rates, P&amp;L, W/L sequence by setup tag.</CardDescription>
            </div>
            <Link href="/dashboard/journal" className="text-xs text-brand font-semibold hover:underline flex items-center gap-0.5">
              Trade Log <ArrowUpRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[340px] overflow-y-auto">
            {strategyBreakdown.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No strategies yet"
                description="Log trades with setup tags (TJL 1, TJL 2 A+) to unlock strategy analytics."
                action={{ label: "Log a trade", href: "/dashboard/journal" }}
                size="sm"
              />
            ) : (
              strategyBreakdown.map((s) => (
                <div key={s.setup} className="p-3 rounded-lg border border-border bg-surface-2/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="brand" className="text-[10px]">{s.setup}</Badge>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <span className="text-brand">{s.winRate}% WR</span>
                      <span className={s.pnl >= 0 ? "text-profit" : "text-loss"}>{s.pnl >= 0 ? "+" : ""}{formatCurrency(s.pnl)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-surface-3 flex-1 overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${s.winRate}%` }} />
                    </div>
                    <div className="flex gap-0.5">
                      {s.seq.map((win, idx) => (
                        <span key={idx} className={cn("w-3 h-3 rounded-sm text-[7px] font-bold flex items-center justify-center text-white", win ? "bg-profit" : "bg-loss")}>
                          {win ? "W" : "L"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand" />
              Session Edge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionBreakdown.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No session data"
                description="Tag London, NY, or Asian session on your trades."
                size="sm"
              />
            ) : (
              sessionBreakdown.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold">{s.key}</span>
                    <span className="font-mono text-brand">{(s.winRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${s.winRate * 100}%` }} />
                  </div>
                  <p className={cn("text-[10px] font-mono", s.netPnl >= 0 ? "text-profit" : "text-loss")}>
                    {s.netPnl >= 0 ? "+" : ""}{formatCurrency(s.netPnl)} · {s.trades} trades
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar + Economic Calendar + Today + Edge + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <TradingCalendarWidget trades={trades} />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Today&apos;s Session</CardTitle>
                <Badge className={cn("text-[10px] border", currentSession.bg, currentSession.color)}>
                  {currentSession.emoji} {currentSession.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-subtle">Daily Risk Usage</span>
                  <span className="font-mono font-bold text-brand">
                    {dailyRiskUsed.toFixed(1)}% / {tradingConfig.dailyRiskLimitPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", dailyRiskUsed > tradingConfig.dailyRiskLimitPct * 0.66 ? "bg-loss" : "bg-brand")}
                    style={{ width: `${Math.min(100, (dailyRiskUsed / tradingConfig.dailyRiskLimitPct) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-2/50 border border-border text-center">
                  <span className="text-[9px] text-foreground-subtle block uppercase">Trades</span>
                  <span className="font-mono font-bold text-sm">{todayTrades.length}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-2/50 border border-border text-center">
                  <span className="text-[9px] text-foreground-subtle block uppercase">Win Rate</span>
                  <span className="font-mono font-bold text-sm text-brand">{todayWinRate.toFixed(0)}%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-2/50 border border-border text-center">
                  <span className="text-[9px] text-foreground-subtle block uppercase">Net P&L</span>
                  <span className={cn("font-mono font-bold text-sm", todayPnl >= 0 ? "text-profit" : "text-loss")}>
                    {todayPnl >= 0 ? "+" : ""}{formatCurrency(todayPnl)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-foreground-subtle font-mono text-right">Risk basis: {formatCurrency(activeBalance)} active capital</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                Edge &amp; Streak Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Best Trading Day", value: `+${formatCurrency(bestDayPnl)}`, color: "text-profit", icon: Award },
                { label: "Top Asset", value: topAsset, color: "text-brand", icon: Globe },
                { label: "Max Win Streak", value: `${metrics.maxWinStreak}`, color: "text-emerald-400", icon: Flame },
                { label: "Top Strategy", value: topStrategy, color: "text-warning", icon: Shield },
              ].map((m) => (
                <div key={m.label} className="p-2.5 rounded-lg border border-border bg-surface-2/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <m.icon className="w-3 h-3 text-foreground-subtle" />
                    <span className="text-[9px] text-foreground-subtle uppercase font-bold">{m.label}</span>
                  </div>
                  <p className={cn("font-mono font-bold text-sm truncate", m.color)}>{m.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" />
                Recent Executions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentTrades.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No trades yet"
                description="Your recent executions will appear here."
                action={{ label: "Log first trade", href: "/dashboard/journal" }}
                size="sm"
              />
            ) : (
                recentTrades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border/50 bg-surface-2/20">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{t.symbol}</span>
                      <Badge variant={t.direction === "LONG" ? "profit" : "loss"} className="text-[8px]">{t.direction}</Badge>
                    </div>
                    <span className={cn("font-mono font-bold tabular", (t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                      {(t.pnl ?? 0) >= 0 ? "+" : ""}{formatCurrency(t.pnl ?? 0)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
