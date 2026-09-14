"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrades } from "@/lib/journal/actions";
import { calculateMetrics } from "@/lib/journal/metrics";
import type { Trade } from "@/lib/journal/types";
import { getTradingAccounts } from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getActiveAccountId, setActiveAccountIdSynced } from "@/lib/accounts/active-account";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";

type TabKey = "overview" | "wins" | "calendar";
type Timeframe = "7D" | "30D" | "90D" | "ALL";

type DayRow = {
  date: string;
  label: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  volume: number;
  cumulative: number;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "wins", label: "Wins vs Losses" },
  { key: "calendar", label: "Calendar" },
];

const timeframes: Timeframe[] = ["7D", "30D", "90D", "ALL"];

const moneyClass = (value: number) => value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-foreground";
const pct = (value: number) => `${value.toFixed(1)}%`;

function tradeDate(t: Trade) {
  return (t.exit_time ?? t.entry_time).split("T")[0];
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function weekKey(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return start.toISOString().split("T")[0];
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "profit" | "loss" | "brand";
}) {
  return (
    <Card className="card-hover bg-surface/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-foreground-muted">{label}</p>
          <span className={cn(
            "mt-0.5 h-1.5 w-1.5 rounded-full",
            tone === "profit" ? "bg-profit" : tone === "loss" ? "bg-loss" : tone === "brand" ? "bg-brand" : "bg-foreground-subtle",
          )} />
        </div>
        <div className={cn(
          "mt-2 text-2xl font-extrabold font-mono tabular",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "brand" ? "text-brand" : "text-foreground",
        )}>
          {value}
        </div>
        {sub ? <p className="mt-1 text-[11px] text-foreground-subtle">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "profit" | "loss" | "brand" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 py-3 last:border-b-0">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className={cn(
        "text-sm font-bold font-mono tabular",
        tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "brand" ? "text-brand" : "text-foreground",
      )}>
        {value}
      </span>
    </div>
  );
}

export function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccId, setActiveAccId] = useState("all");
  const [initialLoad, setInitialLoad] = useState(true);
  const [accountSwitching, setAccountSwitching] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    const savedAccId = getActiveAccountId();
    const [tradesRes, accsRes] = await Promise.all([
      getTrades(savedAccId),
      getTradingAccounts(),
    ]);
    const allAccounts = accsRes.data ?? [];
    const loadedTrades = tradesRes.data ?? [];

    setAccounts(allAccounts);
    setActiveAccId(savedAccId);
    setTrades(loadedTrades);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    load();
    const handler = async () => {
      setAccountSwitching(true);
      await load();
      setAccountSwitching(false);
    };
    window.addEventListener("active_account_changed", handler);
    return () => window.removeEventListener("active_account_changed", handler);
  }, [load]);

  const filteredTrades = useMemo(() => {
    if (timeframe === "ALL") return trades;
    const days = timeframe === "7D" ? 7 : timeframe === "30D" ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86400000);
    return trades.filter((t) => new Date(t.entry_time) >= cutoff);
  }, [trades, timeframe]);

  const closedTrades = useMemo(
    () => filteredTrades.filter((t) => t.status === "closed" && t.pnl != null),
    [filteredTrades],
  );

  const metrics = useMemo(() => calculateMetrics(filteredTrades), [filteredTrades]);

  const dayRows = useMemo<DayRow[]>(() => {
    const map = new Map<string, Omit<DayRow, "label" | "cumulative">>();
    for (const t of closedTrades) {
      const date = tradeDate(t);
      const row = map.get(date) ?? { date, pnl: 0, trades: 0, wins: 0, losses: 0, volume: 0 };
      const pnl = t.pnl ?? 0;
      row.pnl += pnl;
      row.trades += 1;
      row.wins += pnl > 0 ? 1 : 0;
      row.losses += pnl < 0 ? 1 : 0;
      row.volume += Number(t.quantity ?? 0);
      map.set(date, row);
    }

    let cumulative = 0;
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        cumulative += row.pnl;
        return {
          ...row,
          label: new Date(`${row.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          cumulative,
        };
      });
  }, [closedTrades]);

  const richStats = useMemo(() => {
    const winners = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losers = closedTrades.filter((t) => (t.pnl ?? 0) < 0);
    const totalProfit = winners.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
    const netPnl = totalProfit - totalLoss;
    const tradingDays = dayRows.length;
    const winDays = dayRows.filter((d) => d.pnl > 0);
    const lossDays = dayRows.filter((d) => d.pnl < 0);
    const monthRows = Array.from(dayRows.reduce((map, d) => {
      const key = monthKey(d.date);
      const row = map.get(key) ?? { key, pnl: 0, trades: 0, wins: 0, losses: 0 };
      row.pnl += d.pnl;
      row.trades += d.trades;
      row.wins += d.wins;
      row.losses += d.losses;
      map.set(key, row);
      return map;
    }, new Map<string, { key: string; pnl: number; trades: number; wins: number; losses: number }>()).values());
    const weekRows = Array.from(dayRows.reduce((map, d) => {
      const key = weekKey(d.date);
      const row = map.get(key) ?? { key, pnl: 0, trades: 0, wins: 0, losses: 0 };
      row.pnl += d.pnl;
      row.trades += d.trades;
      row.wins += d.wins;
      row.losses += d.losses;
      map.set(key, row);
      return map;
    }, new Map<string, { key: string; pnl: number; trades: number; wins: number; losses: number }>()).values());
    const emptyDay = { pnl: 0, trades: 0, wins: 0, losses: 0, volume: 0, date: "-", label: "-", cumulative: 0 };
    const emptyPeriod = { key: "-", pnl: 0, trades: 0, wins: 0, losses: 0 };
    const bestDay = dayRows.length ? dayRows.reduce((best, row) => row.pnl > best.pnl ? row : best) : emptyDay;
    const worstDay = dayRows.length ? dayRows.reduce((worst, row) => row.pnl < worst.pnl ? row : worst) : emptyDay;
    const bestMonth = monthRows.length ? monthRows.reduce((best, row) => row.pnl > best.pnl ? row : best) : emptyPeriod;
    const worstMonth = monthRows.length ? monthRows.reduce((worst, row) => row.pnl < worst.pnl ? row : worst) : emptyPeriod;
    const bestWeek = weekRows.length ? weekRows.reduce((best, row) => row.pnl > best.pnl ? row : best) : emptyPeriod;
    const worstWeek = weekRows.length ? weekRows.reduce((worst, row) => row.pnl < worst.pnl ? row : worst) : emptyPeriod;
    const avgWinDay = winDays.length ? winDays.reduce((sum, d) => sum + d.pnl, 0) / winDays.length : 0;
    const avgLossDay = lossDays.length ? lossDays.reduce((sum, d) => sum + d.pnl, 0) / lossDays.length : 0;
    const totalVolume = closedTrades.reduce((sum, t) => sum + Number(t.quantity ?? 0), 0);
    const avgDailyVolume = tradingDays ? totalVolume / tradingDays : 0;

    return {
      winners,
      losers,
      totalProfit,
      totalLoss,
      netPnl,
      tradingDays,
      winDays,
      lossDays,
      monthRows,
      weekRows,
      bestDay,
      worstDay,
      bestMonth,
      worstMonth,
      bestWeek,
      worstWeek,
      avgTradePnl: closedTrades.length ? netPnl / closedTrades.length : 0,
      avgWin: winners.length ? totalProfit / winners.length : 0,
      avgLoss: losers.length ? -totalLoss / losers.length : 0,
      avgWinDay,
      avgLossDay,
      avgDailyVolume,
      totalVolume,
      openTrades: filteredTrades.filter((t) => t.status === "open").length,
      profitableDaysPct: tradingDays ? (winDays.length / tradingDays) * 100 : 0,
      avgTradesPerDay: tradingDays ? closedTrades.length / tradingDays : 0,
      breakevens: Math.max(0, metrics.closedTrades - winners.length - losers.length),
    };
  }, [closedTrades, dayRows, filteredTrades, metrics.closedTrades]);

  const streaks = useMemo(() => {
    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    let maxWinDays = 0, maxLossDays = 0, curWinDays = 0, curLossDays = 0;
    const winRuns: number[] = [];
    const lossRuns: number[] = [];

    for (const t of closedTrades.slice().sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())) {
      const pnl = t.pnl ?? 0;
      if (pnl > 0) {
        curWin += 1;
        curLoss = 0;
      } else if (pnl < 0) {
        if (curWin > 0) winRuns.push(curWin);
        curLoss += 1;
        curWin = 0;
      }
      maxWin = Math.max(maxWin, curWin);
      maxLoss = Math.max(maxLoss, curLoss);
    }
    if (curWin > 0) winRuns.push(curWin);
    if (curLoss > 0) lossRuns.push(curLoss);

    for (const d of dayRows) {
      if (d.pnl > 0) {
        curWinDays += 1;
        curLossDays = 0;
      } else if (d.pnl < 0) {
        curLossDays += 1;
        curWinDays = 0;
      }
      maxWinDays = Math.max(maxWinDays, curWinDays);
      maxLossDays = Math.max(maxLossDays, curLossDays);
    }

    return {
      maxWin,
      maxLoss,
      avgWin: winRuns.length ? winRuns.reduce((s, v) => s + v, 0) / winRuns.length : 0,
      avgLoss: lossRuns.length ? lossRuns.reduce((s, v) => s + v, 0) / lossRuns.length : 0,
      maxWinDays,
      maxLossDays,
    };
  }, [closedTrades, dayRows]);

  const rangeData = useMemo(() => {
    const profitRanges = [
      { label: "$0-$50", min: 0, max: 50 },
      { label: "$51-$200", min: 51, max: 200 },
      { label: "$201+", min: 201, max: Infinity },
    ].map((range) => ({
      label: range.label,
      count: richStats.winners.filter((t) => (t.pnl ?? 0) >= range.min && (t.pnl ?? 0) <= range.max).length,
    }));
    const lossRanges = [
      { label: "$0-$50", min: 0, max: 50 },
      { label: "$51-$200", min: 51, max: 200 },
      { label: "$201+", min: 201, max: Infinity },
    ].map((range) => ({
      label: range.label,
      count: richStats.losers.filter((t) => Math.abs(t.pnl ?? 0) >= range.min && Math.abs(t.pnl ?? 0) <= range.max).length,
    }));
    return { profitRanges, lossRanges };
  }, [richStats.losers, richStats.winners]);

  const yearCalendar = useMemo(() => {
    const dayMap = new Map(dayRows.map((d) => [d.date, d]));
    const maxAbs = Math.max(1, ...dayRows.map((d) => Math.abs(d.pnl)));
    const months = Array.from({ length: 12 }, (_, month) => {
      const first = new Date(calendarYear, month, 1);
      const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
      const daysInMonth = new Date(calendarYear, month + 1, 0).getDate();
      const cells: ({ day: number; date: string; data?: DayRow } | null)[] = [];
      for (let i = 0; i < offset; i++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${calendarYear}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        cells.push({ day, date, data: dayMap.get(date) });
      }
      return { month, label: first.toLocaleDateString("en-US", { month: "short" }), cells };
    });
    return { months, maxAbs };
  }, [calendarYear, dayRows]);

  const activeAccount = accounts.find((a) => a.id === activeAccId);

  useEffect(() => {
    if (dayRows.length > 0) {
      setCalendarYear(new Date(`${dayRows[dayRows.length - 1].date}T00:00:00`).getFullYear());
    }
  }, [dayRows]);

  if (initialLoad) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <PageTransition className="relative space-y-6">
      {accountSwitching ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : null}

      <FadeIn>
        <div className="flex flex-col gap-4 border-b border-border/70 pb-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">My Stats</h1>
              <p className="text-xs text-foreground-muted">Account performance, win/loss behavior, and calendar edge.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full border border-border bg-surface p-1 overflow-x-auto">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", timeframe === tf ? "bg-brand text-brand-foreground" : "text-foreground-muted hover:text-foreground")}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <button className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Customize
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-border bg-surface p-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "rounded-full px-5 py-2 text-xs font-bold transition",
                    activeTab === tab.key ? "bg-brand text-brand-foreground shadow-sm" : "text-foreground-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeAccId !== "all" ? (
              <div className="flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeAccount?.color || "var(--brand)" }} />
                <span className="font-semibold text-foreground">{activeAccount?.name ?? "Selected Account"}</span>
                <button onClick={() => setActiveAccountIdSynced("all")} className="ml-1 text-foreground-subtle underline hover:text-foreground">
                  All
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </FadeIn>

      {activeTab === "overview" ? (
        <OverviewTab metrics={metrics} stats={richStats} streaks={streaks} closedTrades={closedTrades} dayRows={dayRows} />
      ) : activeTab === "wins" ? (
        <WinsTab dayRows={dayRows} stats={richStats} streaks={streaks} rangeData={rangeData} />
      ) : (
        <CalendarTab
          year={calendarYear}
          setYear={setCalendarYear}
          stats={richStats}
          streaks={streaks}
          yearCalendar={yearCalendar}
          dayRows={dayRows}
        />
      )}
    </PageTransition>
  );
}

function OverviewTab({ metrics, stats, streaks, closedTrades, dayRows }: { metrics: ReturnType<typeof calculateMetrics>; stats: any; streaks: any; closedTrades: Trade[]; dayRows: DayRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="Net P&L" value={formatCurrency(stats.netPnl)} sub={`${metrics.closedTrades} trades`} tone={stats.netPnl >= 0 ? "profit" : "loss"} />
        <StatCard label="Avg Daily P&L" value={formatCurrency(stats.tradingDays ? stats.netPnl / stats.tradingDays : 0)} sub={`${stats.tradingDays} trading days`} tone={stats.netPnl >= 0 ? "profit" : "loss"} />
        <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)} sub={`${formatCurrency(stats.totalProfit)} / ${formatCurrency(stats.totalLoss)}`} tone="brand" />
        <StatCard label="Win Rate" value={pct(metrics.winRate * 100)} sub={`${stats.winners.length}W / ${stats.losers.length}L`} tone="brand" />
        <StatCard label="Trading Days" value={stats.tradingDays} sub={`${stats.winDays.length}W / ${stats.lossDays.length}L`} tone="brand" />
        <StatCard label="Total Trades" value={metrics.totalTrades} sub={`${stats.winners.length}W / ${stats.breakevens}B / ${stats.losers.length}L`} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="card-hover">
          <CardHeader><CardTitle className="text-base">P&L Statistics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <MiniMetric label="Avg Trade P&L" value={formatCurrency(stats.avgTradePnl)} tone={stats.avgTradePnl >= 0 ? "profit" : "loss"} />
            <MiniMetric label="Trade Expectancy" value={formatCurrency(metrics.expectancy)} tone={metrics.expectancy >= 0 ? "profit" : "loss"} />
            <MiniMetric label="Avg. Winning Trade" value={formatCurrency(stats.avgWin)} tone="profit" />
            <MiniMetric label="Avg. Losing Trade" value={formatCurrency(stats.avgLoss)} tone="loss" />
            <MiniMetric label="Avg Winning Day P&L" value={formatCurrency(stats.avgWinDay)} tone="profit" />
            <MiniMetric label="Avg Losing Day P&L" value={formatCurrency(stats.avgLossDay)} tone="loss" />
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader><CardTitle className="text-base">Performance Extremes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <MiniMetric label="Largest Profit" value={formatCurrency(metrics.bestTrade)} tone="profit" />
            <MiniMetric label="Largest Loss" value={formatCurrency(metrics.worstTrade)} tone="loss" />
            <MiniMetric label="Best Day Profit" value={formatCurrency(stats.bestDay.pnl)} tone="profit" />
            <MiniMetric label="Worst Day Loss" value={formatCurrency(stats.worstDay.pnl)} tone="loss" />
            <MiniMetric label={`Best Month ${stats.bestMonth.key !== "-" ? `(${stats.bestMonth.key})` : ""}`} value={formatCurrency(stats.bestMonth.pnl)} tone="profit" />
            <MiniMetric label={`Worst Month ${stats.worstMonth.key !== "-" ? `(${stats.worstMonth.key})` : ""}`} value={formatCurrency(stats.worstMonth.pnl)} tone="loss" />
            <MiniMetric label="Total Profit" value={formatCurrency(stats.totalProfit)} tone="profit" />
            <MiniMetric label="Total Loss" value={formatCurrency(-stats.totalLoss)} tone="loss" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="card-hover">
          <CardHeader><CardTitle className="text-base">Streaks & Patterns</CardTitle></CardHeader>
          <CardContent>
            <MiniMetric label="Max Win Streak (trades)" value={streaks.maxWin} tone="profit" />
            <MiniMetric label="Max Loss Streak (trades)" value={streaks.maxLoss} tone="loss" />
            <MiniMetric label="Avg Win Streak (trades)" value={streaks.avgWin.toFixed(2)} tone="neutral" />
            <MiniMetric label="Avg Loss Streak (trades)" value={streaks.avgLoss.toFixed(2)} tone="neutral" />
            <MiniMetric label="Max Winning Days" value={streaks.maxWinDays} tone="profit" />
            <MiniMetric label="Max Losing Days" value={streaks.maxLossDays} tone="loss" />
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle className="text-base">Trading Activity</CardTitle></CardHeader>
          <CardContent>
            <MiniMetric label="Total Trades" value={metrics.totalTrades} />
            <MiniMetric label="Open Trades" value={stats.openTrades} />
            <MiniMetric label="Total Trading Days" value={stats.tradingDays} />
            <MiniMetric label="Avg Daily Volume" value={stats.avgDailyVolume.toFixed(2)} />
            <MiniMetric label="Total Volume" value={stats.totalVolume.toFixed(2)} />
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle className="text-base">Costs & Fees</CardTitle></CardHeader>
          <CardContent>
            <MiniMetric label="Total Commissions" value={formatCurrency(0)} tone="loss" />
            <MiniMetric label="Total Swap" value={formatCurrency(0)} tone="brand" />
            <MiniMetric label="Total Costs" value={formatCurrency(0)} tone="loss" />
          </CardContent>
        </Card>
      </div>

      <OverviewSuite trades={closedTrades} dayRows={dayRows} />
    </div>
  );
}

type Breakdown = { label: string; trades: number; pnl: number; wins: number; losses: number; profit: number; loss: number };

function groupTrades(trades: Trade[], labelFor: (trade: Trade) => string) {
  const groups = new Map<string, Breakdown>();
  for (const trade of trades) {
    const label = labelFor(trade);
    const group = groups.get(label) ?? { label, trades: 0, pnl: 0, wins: 0, losses: 0, profit: 0, loss: 0 };
    const pnl = trade.pnl ?? 0;
    group.trades += 1;
    group.pnl += pnl;
    if (pnl > 0) { group.wins += 1; group.profit += pnl; }
    if (pnl < 0) { group.losses += 1; group.loss += Math.abs(pnl); }
    groups.set(label, group);
  }
  return Array.from(groups.values());
}

function holdBucket(trade: Trade) {
  if (!trade.exit_time) return "Open";
  const mins = Math.max(0, (new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime()) / 60000);
  return mins < 1 ? "Under 1 min" : mins < 10 ? "1 min to 10 mins" : mins < 60 ? "10 mins to 1h" : mins < 240 ? "1h to 4h" : "4h to 24h";
}

function rBucket(trade: Trade) {
  const r = trade.r_multiple;
  if (r == null) return "No R data";
  return r <= -4 ? "-4R or less" : r < 0 ? "-4R to 0R" : r < 1 ? "0R to 0.99R" : r < 4 ? "1R to 3.99R" : "+4R and more";
}

function OverviewSuite({ trades, dayRows }: { trades: Trade[]; dayRows: DayRow[] }) {
  const weekday = groupTrades(trades, (t) => new Date(t.exit_time ?? t.entry_time).toLocaleDateString("en-US", { weekday: "long" }));
  const week = groupTrades(trades, (t) => weekKey(tradeDate(t)));
  const month = groupTrades(trades, (t) => new Date(`${tradeDate(t)}T00:00:00`).toLocaleDateString("en-US", { month: "long" }));
  const hour = groupTrades(trades, (t) => `${String(new Date(t.entry_time).getUTCHours()).padStart(2, "0")}:00`);
  const duration = groupTrades(trades, holdBucket);
  const symbols = groupTrades(trades, (t) => t.symbol || "Unknown").sort((a, b) => b.trades - a.trades).slice(0, 10);
  const rMultiples = groupTrades(trades, rBucket);
  const sessions = groupTrades(trades, (t) => t.session || "Outside of Sessions");
  const pairs = groupTrades(trades, (t) => t.symbol || "Unknown");
  const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const orderedWeekday = weekdayOrder.map((label) => weekday.find((row) => row.label === label) ?? { label, trades: 0, pnl: 0, wins: 0, losses: 0, profit: 0, loss: 0 });
  const equity = dayRows.map((day) => ({ ...day, equity: day.cumulative }));

  return <div className="space-y-6">
    <DistributionPanel title="Pair Daily Distribution" data={orderedWeekday} mode="pnl" wide />
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <DistributionPanel title="Weekly Trade Distribution" subtitle="Performance breakdown by weekday" data={orderedWeekday} mode="wins-losses" />
      <EquityPanel data={equity} />
      <DistributionPanel title="Trade Distribution by Week" data={orderedWeekday} mode="trades" horizontal />
      <DistributionPanel title="Performance by Week" data={orderedWeekday} mode="pnl" horizontal />
      <DistributionPanel title="Trade Distribution (calendar weeks)" data={week} mode="trades" horizontal />
      <DistributionPanel title="Performance by calendar week" data={week} mode="pnl" horizontal />
      <DistributionPanel title="Trade Distribution by Month" data={month} mode="trades" horizontal />
      <DistributionPanel title="Performance by Month" data={month} mode="pnl" horizontal />
      <DistributionPanel title="Trade Distribution by Hour (UTC)" data={hour} mode="trades" horizontal />
      <DistributionPanel title="Performance by Hour (UTC)" data={hour} mode="pnl" horizontal />
      <DistributionPanel title="Trade Distribution by Intraday Duration" data={duration} mode="trades" horizontal />
      <DistributionPanel title="Performance by Intraday Duration" data={duration} mode="pnl" horizontal />
      <DistributionPanel title="Top 10 Symbol" data={symbols} mode="trades" horizontal />
      <DistributionPanel title="Performance by Symbol" data={symbols} mode="pnl" horizontal />
      <DistributionPanel title="Trade Distribution by R Multiple" data={rMultiples} mode="trades" horizontal />
      <DistributionPanel title="Performance by R Multiple" data={rMultiples} mode="pnl" horizontal />
    </div>
    <SummaryPanel title="Summary Week" rows={orderedWeekday} firstColumn="Day" />
    <SummaryPanel title="Summary Pairs" rows={pairs} firstColumn="Pair" />
    <SummaryPanel title="Summary Session" rows={sessions} firstColumn="Session" />
  </div>;
}

function DistributionPanel({ title, subtitle, data, mode, horizontal = false, wide = false }: { title: string; subtitle?: string; data: Breakdown[]; mode: "trades" | "pnl" | "wins-losses"; horizontal?: boolean; wide?: boolean }) {
  const chartData = data.map((row) => ({ ...row, positive: Math.max(0, row.pnl), negative: Math.min(0, row.pnl) }));
  const value = mode === "trades" ? "trades" : mode === "wins-losses" ? "wins" : "pnl";
  return <Card className={cn("card-hover", wide && "w-full")}><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="text-base">{title}</CardTitle>{subtitle ? <CardDescription>{subtitle}</CardDescription> : null}</div><Badge variant="outline">Options</Badge></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 18 : 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} horizontal={!horizontal} vertical={horizontal} />{horizontal ? <><XAxis type="number" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => mode === "pnl" ? `$${v}` : String(v)} /><YAxis type="category" width={105} dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} /></> : <><XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} /></>}<Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} formatter={(v) => [mode === "pnl" ? formatCurrency(Number(v)) : v, mode === "pnl" ? "Net P&L" : mode === "trades" ? "Trades" : "Wins"]} />{mode === "pnl" ? <><ReferenceLine x={horizontal ? 0 : undefined} y={horizontal ? undefined : 0} stroke="var(--foreground-subtle)" /><Bar dataKey="positive" fill="#34d399" radius={[3, 3, 3, 3]} /><Bar dataKey="negative" fill="#fb7185" radius={[3, 3, 3, 3]} /></> : mode === "wins-losses" ? <><Bar dataKey="wins" fill="#34d399" radius={[4, 4, 0, 0]} /><Bar dataKey="losses" fill="#fb7185" radius={[4, 4, 0, 0]} /></> : <Bar dataKey={value} fill="var(--brand)" radius={[4, 4, 4, 4]} />}</BarChart></ResponsiveContainer></CardContent></Card>;
}

function EquityPanel({ data }: { data: (DayRow & { equity: number })[] }) { return <Card className="card-hover"><CardHeader className="flex-row items-start justify-between"><CardTitle className="text-base">Equity Line</CardTitle><Badge variant="brand">All</Badge></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} /><XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} /><Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} formatter={(v) => [formatCurrency(Number(v)), "Equity"]} /><Area type="monotone" dataKey="equity" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.22} strokeWidth={2.5} /></AreaChart></ResponsiveContainer></CardContent></Card>; }

function SummaryPanel({ title, rows, firstColumn }: { title: string; rows: Breakdown[]; firstColumn: string }) { const best = rows.reduce((bestRow, row) => row.pnl > bestRow.pnl ? row : bestRow, rows[0] ?? { pnl: 0 }); const worst = rows.reduce((worstRow, row) => row.pnl < worstRow.pnl ? row : worstRow, rows[0] ?? { pnl: 0 }); return <Card className="card-hover"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-xs"><thead className="text-left text-foreground-muted"><tr><th className="pb-3">{firstColumn}</th><th className="pb-3 text-right">Net P&L</th><th className="pb-3 text-right">Winning %</th><th className="pb-3 text-right">Total Profit</th><th className="pb-3 text-right">Total Loss</th><th className="pb-3 text-right">Total Trades</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label} className="border-t border-border/70"><td className="py-3 font-semibold">{row.label} {row === best ? <Badge variant="profit">Best</Badge> : row === worst ? <Badge variant="loss">Worst</Badge> : null}</td><td className={cn("py-3 text-right font-mono font-bold", row.pnl >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(row.pnl)}</td><td className="py-3 text-right">{pct(row.trades ? row.wins / row.trades * 100 : 0)}</td><td className="py-3 text-right text-profit">{formatCurrency(row.profit)}</td><td className="py-3 text-right text-loss">{formatCurrency(-row.loss)}</td><td className="py-3 text-right font-mono">{row.trades}</td></tr>)}</tbody></table></CardContent></Card>; }

function WinsTab({ dayRows, stats, streaks, rangeData }: { dayRows: DayRow[]; stats: any; streaks: any; rangeData: any }) {
  return (
    <div className="space-y-6">
      <Card className="card-hover">
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">Daily Net Cumulative P&L</CardTitle>
            <CardDescription>Current {formatCurrency(stats.netPnl)} · Peak {formatCurrency(Math.max(0, ...dayRows.map((d) => d.cumulative)))} · Trough {formatCurrency(Math.min(0, ...dayRows.map((d) => d.cumulative)))}</CardDescription>
          </div>
          <Badge variant="brand">All</Badge>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dayRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.45} />
              <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--foreground-subtle)" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} formatter={(v, n) => [formatCurrency(Number(v)), n === "cumulative" ? "Cumulative" : "Daily P&L"]} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dayRows.map((d) => <Cell key={d.date} fill={d.pnl >= 0 ? "#34d399" : "#fb7185"} fillOpacity={0.28} />)}
              </Bar>
              <Line dataKey="cumulative" type="monotone" stroke="var(--brand)" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader><CardTitle className="text-base">Net Daily P&L</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.45} />
              <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--foreground-subtle)" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} formatter={(v) => [formatCurrency(Number(v)), "Net P&L"]} />
              <Bar dataKey="pnl" radius={[5, 5, 0, 0]}>
                {dayRows.map((d) => <Cell key={d.date} fill={d.pnl >= 0 ? "#34d399" : "#fb7185"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PerformancePanel title="Win Performance" tone="profit" data={dayRows.filter((d) => d.pnl > 0)} stats={[
          ["Total P&L", formatCurrency(stats.totalProfit)],
          ["Winning Trades", stats.winners.length],
          ["Avg Daily Volume", stats.avgDailyVolume.toFixed(2)],
          ["Avg. Winning Trade", formatCurrency(stats.avgWin)],
          ["Total Commissions", formatCurrency(0)],
          ["Max Consecutive Wins", streaks.maxWin],
        ]} />
        <PerformancePanel title="Loss Performance" tone="loss" data={dayRows.filter((d) => d.pnl < 0).map((d) => ({ ...d, pnl: d.pnl }))} stats={[
          ["Total P&L", formatCurrency(-stats.totalLoss)],
          ["Losing Trades", stats.losers.length],
          ["Avg Daily Volume", stats.avgDailyVolume.toFixed(2)],
          ["Avg. Losing Trade", formatCurrency(stats.avgLoss)],
          ["Total Commissions", formatCurrency(0)],
          ["Max Consecutive Loss", streaks.maxLoss],
        ]} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RangePanel title="Performance by Profit Range" data={rangeData.profitRanges} color="#34d399" />
        <RangePanel title="Performance by Loss Range" data={rangeData.lossRanges} color="#fb7185" />
      </div>
    </div>
  );
}

function PerformancePanel({ title, tone, data, stats }: { title: string; tone: "profit" | "loss"; data: DayRow[]; stats: [string, React.ReactNode][] }) {
  return (
    <Card className="card-hover">
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant={tone}>{tone === "profit" ? "Wins" : "Losses"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} formatter={(v) => [formatCurrency(Number(v)), "P&L"]} />
              <Line dataKey="pnl" type="monotone" stroke={tone === "profit" ? "#34d399" : "#fb7185"} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-surface-2/35 p-3">
              <p className="text-xs text-foreground-muted">{label}</p>
              <p className="mt-1 font-mono text-sm font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RangePanel({ title, data, color }: { title: string; data: { label: string; count: number }[]; color: string }) {
  return (
    <Card className="card-hover">
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="outline">Options</Badge>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.45} horizontal={false} />
            <XAxis type="number" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} width={82} />
            <Tooltip contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }} />
            <Bar dataKey="count" fill={color} radius={[0, 5, 5, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CalendarTab({ year, setYear, stats, streaks, yearCalendar, dayRows }: { year: number; setYear: (year: number) => void; stats: any; streaks: any; yearCalendar: any; dayRows: DayRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Best Month" value={formatCurrency(stats.bestMonth.pnl)} sub={`${stats.bestMonth.trades} trades · ${pct(stats.bestMonth.trades ? (stats.bestMonth.wins / stats.bestMonth.trades) * 100 : 0)} win`} tone="profit" />
        <StatCard label="Worst Month" value={formatCurrency(stats.worstMonth.pnl)} sub={`${stats.worstMonth.trades} trades · ${pct(stats.worstMonth.trades ? (stats.worstMonth.wins / stats.worstMonth.trades) * 100 : 0)} win`} tone="loss" />
        <StatCard label="Best Week" value={formatCurrency(stats.bestWeek.pnl)} sub={`${stats.bestWeek.trades} trades · ${pct(stats.bestWeek.trades ? (stats.bestWeek.wins / stats.bestWeek.trades) * 100 : 0)} win`} tone="profit" />
        <StatCard label="Worst Week" value={formatCurrency(stats.worstWeek.pnl)} sub={`${stats.worstWeek.trades} trades · ${pct(stats.worstWeek.trades ? (stats.worstWeek.wins / stats.worstWeek.trades) * 100 : 0)} win`} tone="loss" />
        <StatCard label="Win Streak" value={`${streaks.maxWinDays} days`} sub="Longest consecutive winning days" tone="profit" />
        <StatCard label="Loss Streak" value={`${streaks.maxLossDays} days`} sub="Longest consecutive losing days" tone="loss" />
        <StatCard label="Profitable Days" value={pct(stats.profitableDaysPct)} sub={`${stats.winDays.length} of ${stats.tradingDays} days`} tone="brand" />
        <StatCard label="Avg Trades/Day" value={stats.avgTradesPerDay.toFixed(1)} sub={`${stats.tradingDays} trading days`} tone="neutral" />
      </div>

      <Card className="card-hover">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Year at a Glance</CardTitle>
            <CardDescription>Daily P&L heatmap using your selected account and timeframe.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">$</Badge>
            <button onClick={() => setYear(year - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-sm font-bold">{year}</span>
            <button onClick={() => setYear(year + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
            {yearCalendar.months.map((month: any) => (
              <div key={month.month} className="rounded-lg bg-surface/45 p-3">
                <p className="mb-2 text-xs font-bold text-foreground-muted">{month.label}</p>
                <div className="grid grid-cols-7 gap-1 pb-1">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, index) => <span key={`${d}-${index}`} className="text-center text-[9px] text-foreground-subtle">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {month.cells.map((cell: any, index: number) => {
                    const pnl = cell?.data?.pnl ?? 0;
                    const intensity = Math.min(1, Math.abs(pnl) / yearCalendar.maxAbs);
                    const style = cell?.data ? {
                      backgroundColor: pnl >= 0 ? `rgba(52, 211, 153, ${0.16 + intensity * 0.58})` : `rgba(251, 113, 133, ${0.16 + intensity * 0.58})`,
                      borderColor: pnl >= 0 ? "rgba(52, 211, 153, 0.55)" : "rgba(251, 113, 133, 0.55)",
                    } : undefined;
                    return (
                      <div
                        key={cell?.date ?? `blank-${index}`}
                        style={style}
                        title={cell?.data ? `${cell.date} · ${formatCurrency(pnl, { sign: true })} · ${cell.data.trades} trades` : undefined}
                        className={cn("flex aspect-square items-center justify-center rounded border text-[9px] font-mono", cell ? "border-border/40 bg-surface-2/40 text-foreground-subtle" : "border-transparent", cell?.data && (pnl >= 0 ? "text-profit" : "text-loss"))}
                      >
                        {cell?.day ?? ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CalendarBreakdowns year={year} months={yearCalendar.months} stats={stats} dayRows={dayRows} />
    </div>
  );
}

function CalendarBreakdowns({ year, months, stats, dayRows }: { year: number; months: any[]; stats: any; dayRows: DayRow[] }) {
  const quarterRows = Array.from({ length: 4 }, (_, quarter) => {
    const subset = months.slice(quarter * 3, quarter * 3 + 3);
    return { label: `Q${quarter + 1}`, months: subset };
  });
  const monthGrid = months.map((month) => {
    const days = month.cells.filter(Boolean).map((cell: any) => cell.data).filter(Boolean) as DayRow[];
    const pnl = days.reduce((sum, d) => sum + d.pnl, 0);
    const trades = days.reduce((sum, d) => sum + d.trades, 0);
    const wins = days.reduce((sum, d) => sum + d.wins, 0);
    return { label: month.label, pnl, trades, winRate: trades ? wins / trades * 100 : 0 };
  });
  return <div className="space-y-6">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">{quarterRows.map((quarter) => { const quarterPnl = quarter.months.reduce((sum, month) => sum + month.cells.filter(Boolean).reduce((inner: number, cell: any) => inner + (cell.data?.pnl ?? 0), 0), 0); return <Card key={quarter.label} className="card-hover"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">{quarter.label}</CardTitle><span className={cn("font-mono text-sm font-bold", quarterPnl >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(quarterPnl)}</span></CardHeader><CardContent><table className="w-full text-xs"><thead className="text-left text-foreground-muted"><tr><th className="pb-2">Month</th><th className="pb-2 text-right">Net Profit</th><th className="pb-2 text-right">Win Rate</th><th className="pb-2 text-right">Trades</th></tr></thead><tbody>{quarter.months.map((month: any) => { const row = monthGrid[month.month]; return <tr key={month.label} className="border-t border-border/70"><td className="py-2.5 font-semibold">{month.label}</td><td className={cn("py-2.5 text-right font-mono", row.pnl >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(row.pnl)}</td><td className="py-2.5 text-right">{pct(row.winRate)}</td><td className="py-2.5 text-right">{row.trades}</td></tr>; })}</tbody></table></CardContent></Card>; })}</div>
    <MonthlyCalendarDashboard year={year} dayRows={dayRows} stats={stats} />
  </div>;
}

function MonthlyCalendarDashboard({ year, dayRows, stats }: { year: number; dayRows: DayRow[]; stats: any }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [percentMode, setPercentMode] = useState(false);
  const base = new Date(year, new Date().getMonth() + monthOffset, 1);
  const selectedYear = base.getFullYear();
  const selectedMonth = base.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const startOffset = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7;
  const dayMap = new Map(dayRows.map((day) => [day.date, day]));
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    const date = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, date, data: dayMap.get(date) };
  });
  const weekly = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) => {
    const weekDays = cells.slice(index * 7, index * 7 + 7).filter(Boolean) as { data?: DayRow }[];
    const pnl = weekDays.reduce((sum, day) => sum + (day.data?.pnl ?? 0), 0);
    const trades = weekDays.reduce((sum, day) => sum + (day.data?.trades ?? 0), 0);
    return { label: `Week ${index + 1}`, pnl, trades };
  });
  const monthDays = cells.filter(Boolean).map((cell: any) => cell.data).filter(Boolean) as DayRow[];
  const wins = monthDays.reduce((sum, day) => sum + day.wins, 0);
  const losses = monthDays.reduce((sum, day) => sum + day.losses, 0);
  const allMonthTrades = monthDays.reduce((sum, day) => sum + day.trades, 0);
  const breakevens = Math.max(0, allMonthTrades - wins - losses);
  const totalTrades = allMonthTrades;
  const winPct = totalTrades ? wins / totalTrades * 100 : 0;
  const lossPct = totalTrades ? losses / totalTrades * 100 : 0;
  const calendarDays = monthDays.length;
  return <Card className="card-hover"><CardHeader className="flex-row items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><button onClick={() => setMonthOffset((value) => value - 1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button><CardTitle className="truncate text-base sm:text-lg">{base.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</CardTitle><button onClick={() => setMonthOffset((value) => value + 1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button></div><div className="flex shrink-0 rounded-lg border border-border p-1"><button onClick={() => setPercentMode(false)} className={cn("px-2 py-1 text-xs font-bold", !percentMode && "rounded bg-brand text-brand-foreground")}>$</button><button onClick={() => setPercentMode(true)} className={cn("px-2 py-1 text-xs font-bold", percentMode && "rounded bg-brand text-brand-foreground")}>%</button></div></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{weekly.map((week) => <div key={week.label} className="rounded-xl border border-border bg-surface/40 p-3 text-center"><p className="text-xs text-foreground-muted">{week.label}</p><p className={cn("mt-1 font-mono text-lg font-extrabold", week.pnl >= 0 ? "text-profit" : "text-loss")}>{percentMode ? pct(stats.netPnl ? week.pnl / Math.abs(stats.netPnl) * 100 : 0) : formatCurrency(week.pnl)}</p><p className="text-[10px] text-foreground-subtle">{week.trades} Trades</p></div>)}</div><div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6"><div className="overflow-x-auto pb-2"><div className="grid min-w-[650px] grid-cols-7 gap-1.5">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <p key={day} className="pb-1 text-center text-xs font-bold text-foreground-muted">{day}</p>)}{cells.map((cell, index) => { const pnl = cell?.data?.pnl ?? 0; return <div key={cell?.date ?? `empty-${index}`} className={cn("min-h-24 rounded-2xl border border-border/70 p-2", cell?.data ? (pnl > 0 ? "bg-profit/10" : pnl < 0 ? "bg-loss/10" : "bg-brand/10") : "bg-surface/25")}><p className="font-mono text-xs font-bold text-foreground-muted">{cell ? String(cell.day).padStart(2, "0") : ""}</p>{cell?.data ? <><p className={cn("mt-3 font-mono text-sm font-extrabold", pnl >= 0 ? "text-profit" : "text-loss")}>{percentMode ? pct(stats.netPnl ? pnl / Math.abs(stats.netPnl) * 100 : 0) : formatCurrency(pnl)}</p><p className="mt-1 text-[10px] text-foreground-muted">{cell.data.trades} trades</p></> : null}</div>; })}</div></div><div className="flex flex-col justify-center gap-4"><div className="mx-auto grid h-52 w-52 place-items-center rounded-full" style={{ background: `conic-gradient(#34d399 0 ${winPct}%, #fb7185 ${winPct}% ${winPct + lossPct}%, var(--surface-2) ${winPct + lossPct}% 100%)` }}><div className="grid h-36 w-36 place-items-center rounded-full bg-surface text-center"><span className="font-mono text-2xl font-extrabold">{totalTrades}</span><span className="text-xs text-foreground-muted">Trades</span></div></div><div className="flex justify-center gap-4 text-xs"><span className="text-profit">● Wins {wins}</span><span className="text-loss">● Loss {losses}</span><span className="text-brand">● Breakeven {breakevens}</span></div><div className="grid grid-cols-2 gap-3"><StatCard label="Trading Days" value={calendarDays} /><StatCard label="Day Win Rate" value={pct(calendarDays ? monthDays.filter((day) => day.pnl > 0).length / calendarDays * 100 : 0)} tone="brand" /><StatCard label="Winning Days" value={monthDays.filter((day) => day.pnl > 0).length} tone="profit" /><StatCard label="Losing Days" value={monthDays.filter((day) => day.pnl < 0).length} tone="loss" /></div></div></div></CardContent></Card>;
}
