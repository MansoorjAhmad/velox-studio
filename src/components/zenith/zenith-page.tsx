"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageTransition } from "@/components/ui/motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Brain,
  RefreshCw,
  Loader2,
  Target,
  Activity,
  Zap,
  Inbox,
} from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { getZenithData, type ZenithData } from "@/lib/zenith/actions";
import { getActiveAccountId } from "@/lib/accounts/active-account";
import {
  calculateMetrics,
  calculateDrawdown,
  currentStreak,
  breakdownBySetup,
  breakdownBySession,
  breakdownBySymbol,
  buildEquityCurve,
} from "@/lib/journal/metrics";
import {
  generateLocalInsights,
  type LocalInsight,
} from "@/lib/zenith/local-insights";
import { getAiInsights } from "@/lib/zenith/insights-client";
import { detectPatterns, weeklyPerformanceSummary } from "@/lib/zenith/gemini";
import { ZenithDepth } from "@/components/zenith/zenith-depth";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ZenithPage() {
  const [data, setData] = useState<ZenithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI insight state
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Pattern detection state
  const [patterns, setPatterns] = useState<string | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);

  // Weekly summary state
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const activeAccId = getActiveAccountId();
    const res = await getZenithData(activeAccId);
    if (res.error) setError(res.error);
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const activeAccId = getActiveAccountId();
      const res = await getZenithData(activeAccId);
      if (active) {
        if (res.error) setError(res.error);
        setData(res);
        setLoading(false);
      }
    }
    init();

    const handleAccChange = () => {
      load();
    };
    window.addEventListener("active_account_changed", handleAccChange);
    return () => {
      active = false;
      window.removeEventListener("active_account_changed", handleAccChange);
    };
  }, [load]);

  // Compute metrics from the raw trades
  const trades = useMemo(() => data?.trades ?? [], [data]);
  const metrics = useMemo(() => calculateMetrics(trades), [trades]);
  const drawdown = useMemo(() => calculateDrawdown(trades), [trades]);
  const streak = useMemo(() => currentStreak(trades), [trades]);
  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades]);
  const setupBreakdown = useMemo(() => breakdownBySetup(trades), [trades]);
  const sessionBreakdown = useMemo(() => breakdownBySession(trades), [trades]);
  const symbolBreakdown = useMemo(() => breakdownBySymbol(trades), [trades]);

  // Local insights (no API needed — always available)
  const localInsights = useMemo(
    () =>
      generateLocalInsights(
        metrics,
        setupBreakdown,
        sessionBreakdown,
        symbolBreakdown,
      ),
    [metrics, setupBreakdown, sessionBreakdown, symbolBreakdown],
  );

  // Fetch AI insight on demand
  const fetchAI = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    const metricsJSON = JSON.stringify(
      {
        totalTrades: metrics.totalTrades,
        closedTrades: metrics.closedTrades,
        winRate: metrics.winRate,
        profitFactor: metrics.profitFactor,
        netPnl: metrics.netPnl,
        expectancy: metrics.expectancy,
        avgWin: metrics.avgWin,
        avgLoss: metrics.avgLoss,
        avgRMultiple: metrics.avgRMultiple,
        bestTrade: metrics.bestTrade,
        worstTrade: metrics.worstTrade,
        maxWinStreak: metrics.maxWinStreak,
        maxLossStreak: metrics.maxLossStreak,
        maxDrawdown: drawdown.maxDrawdown,
        currentStreak: streak,
        topSetups: setupBreakdown.slice(0, 3),
        topSessions: sessionBreakdown.slice(0, 3),
      },
      null,
      2,
    );
    const result = await getAiInsights(metricsJSON);
    setAiLoading(false);
    if (result) {
      setAiInsight(result);
    } else {
      setAiError(
        "Couldn't reach Velox Zenith AI engine. Check your API key in Settings, or rely on the local insights below.",
      );
    }
  }, [metrics, drawdown, streak, setupBreakdown, sessionBreakdown]);

  const fetchPatterns = useCallback(async () => {
    setPatternsLoading(true);
    const tradesJSON = JSON.stringify(
      trades.slice(-50).map((t) => ({
        date: t.entry_time,
        symbol: t.symbol,
        direction: t.direction,
        session: t.session,
        pnl: t.pnl,
        rMultiple: t.r_multiple,
        setup: t.setup,
        holdMinutes: t.entry_time && t.exit_time
          ? Math.round((new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000)
          : null,
      })),
      null, 2,
    );
    const result = await detectPatterns(tradesJSON);
    setPatterns(result ?? "No patterns detected — log more trades first.");
    setPatternsLoading(false);
  }, [trades]);

  const fetchWeeklySummary = useCallback(async () => {
    setWeeklyLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const weekTrades = trades.filter((t) =>
      t.entry_time && new Date(t.entry_time) >= sevenDaysAgo,
    );
    const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const weekWins = weekTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const weekDataJSON = JSON.stringify({
      period: `${sevenDaysAgo.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`,
      trades: weekTrades.length,
      wins: weekWins,
      losses: weekTrades.length - weekWins,
      netPnl: weekPnl,
      winRate: weekTrades.length > 0 ? ((weekWins / weekTrades.length) * 100).toFixed(1) : "0",
      tradeLog: weekTrades.slice(-20).map((t) => ({
        date: t.entry_time,
        symbol: t.symbol,
        direction: t.direction,
        pnl: t.pnl,
        setup: t.setup,
        session: t.session,
        rMultiple: t.r_multiple,
      })),
    }, null, 2);
    const result = await weeklyPerformanceSummary(weekDataJSON);
    setWeeklySummary(result ?? "Could not generate summary — check your API key.");
    setWeeklyLoading(false);
  }, [trades]);

  return (
    <PageTransition className="space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-brand/20 glass p-6">

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-brand/15 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight">Velox Zenith</h1>
              <p className="text-sm text-foreground-muted">
                AI-powered analysis of your trading performance.
              </p>
            </div>
          </div>
          {trades.length > 0 && (
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <ZenithSkeleton />
      ) : trades.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Net P&L"
              value={formatCurrency(metrics.netPnl, { sign: true })}
              tone={metrics.netPnl >= 0 ? "profit" : "loss"}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <KpiTile
              label="Win Rate"
              value={formatPercent(metrics.winRate)}
              tone={metrics.winRate >= 0.5 ? "profit" : "neutral"}
              icon={<Target className="w-4 h-4" />}
            />
            <KpiTile
              label="Profit Factor"
              value={
                metrics.profitFactor === Infinity
                  ? "∞"
                  : metrics.profitFactor.toFixed(2)
              }
              tone={metrics.profitFactor >= 1.5 ? "profit" : "loss"}
              icon={<Activity className="w-4 h-4" />}
            />
            <KpiTile
              label="Expectancy"
              value={formatCurrency(metrics.expectancy, { sign: true })}
              tone={metrics.expectancy >= 0 ? "profit" : "loss"}
              icon={<Zap className="w-4 h-4" />}
            />
          </div>

          {/* AI Action buttons row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={fetchAI}
              disabled={aiLoading}
              className="flex items-center gap-3 p-4 rounded-xl border border-brand/25 bg-brand/5 hover:bg-brand/10 hover:border-brand/40 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center shrink-0 group-hover:bg-brand/25 transition-colors">
                {aiLoading ? <Loader2 className="w-4 h-4 text-brand animate-spin" /> : <Brain className="w-4 h-4 text-brand" />}
              </div>
              <div>
                <p className="text-sm font-bold">Analyze Performance</p>
                <p className="text-[10px] text-foreground-subtle">Full AI breakdown of your edge</p>
              </div>
            </button>

            <button
              onClick={fetchPatterns}
              disabled={patternsLoading}
              className="flex items-center gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5 hover:bg-warning/10 hover:border-warning/35 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0 group-hover:bg-warning/25 transition-colors">
                {patternsLoading ? <Loader2 className="w-4 h-4 text-warning animate-spin" /> : <Zap className="w-4 h-4 text-warning" />}
              </div>
              <div>
                <p className="text-sm font-bold">Detect Patterns</p>
                <p className="text-[10px] text-foreground-subtle">Hidden behavioral patterns</p>
              </div>
            </button>

            <button
              onClick={fetchWeeklySummary}
              disabled={weeklyLoading}
              className="flex items-center gap-3 p-4 rounded-xl border border-profit/20 bg-profit/5 hover:bg-profit/10 hover:border-profit/35 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-profit/15 flex items-center justify-center shrink-0 group-hover:bg-profit/25 transition-colors">
                {weeklyLoading ? <Loader2 className="w-4 h-4 text-profit animate-spin" /> : <Lightbulb className="w-4 h-4 text-profit" />}
              </div>
              <div>
                <p className="text-sm font-bold">Summarize My Week</p>
                <p className="text-[10px] text-foreground-subtle">7-day performance debrief</p>
              </div>
            </button>
          </div>

          {/* AI Insight panel */}
          <Card glass className="border-brand/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-brand" />
                  <CardTitle className="text-base">AI Analysis</CardTitle>
                  <Badge variant="brand">Velox Zenith</Badge>
                </div>
                {!aiInsight && !aiLoading && (
                  <Button size="sm" onClick={fetchAI} variant="secondary">
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate
                  </Button>
                )}
              </div>
              <CardDescription>
                Deep-dive into your performance with Velox Zenith AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                  <p className="text-xs text-foreground-subtle pt-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing your trading data...
                  </p>
                </div>
              ) : aiError ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground-muted">{aiError}</p>
                  <Button size="sm" variant="ghost" onClick={fetchAI}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                  </Button>
                </div>
              ) : aiInsight ? (
                <div className="space-y-3">
                  <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground-muted [&_strong]:text-foreground [&_b]:text-foreground whitespace-pre-wrap">
                    {aiInsight}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={fetchAI}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">
                  Click <span className="text-foreground">Generate</span> to let
                  Velox Zenith analyze your {metrics.closedTrades} closed trades and
                  surface the #1 thing to fix, your edge, and a tailored routine.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pattern Detection Result Card */}
          {patterns && (
            <Card glass className="border-warning/20 bg-warning/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-warning" />
                    <CardTitle className="text-base">Detected Patterns</CardTitle>
                    <Badge variant="outline" className="border-warning/30 text-warning text-[10px]">Behavioral Analysis</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={fetchPatterns} className="text-xs">
                    <RefreshCw className="w-3 h-3" /> Re-scan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground-muted [&_strong]:text-foreground [&_b]:text-foreground whitespace-pre-wrap">
                  {patterns}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Performance Summary Result Card */}
          {weeklySummary && (
            <Card glass className="border-profit/20 bg-profit/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-profit" />
                    <CardTitle className="text-base">Weekly Performance Debrief</CardTitle>
                    <Badge variant="profit" className="text-[10px]">7-Day Review</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={fetchWeeklySummary} className="text-xs">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground-muted [&_strong]:text-foreground [&_b]:text-foreground whitespace-pre-wrap">
                  {weeklySummary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Local insights */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-warning" />
              Pattern Insights
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {localInsights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </div>

          {/* Equity curve */}
          {equityCurve.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equity Curve</CardTitle>
                <CardDescription>
                  Cumulative P&amp;L across {equityCurve.length} closed trades.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityCurve}>
                      <defs>
                        <linearGradient id="zenithEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="index"
                        stroke="var(--foreground-subtle)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--foreground-subtle)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCurrency(v, { compact: true })}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--foreground)",
                        }}
                        labelStyle={{ color: "var(--foreground-subtle)" }}
                        formatter={(value) => [
                          formatCurrency(Number(value)),
                          "Equity",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="var(--brand)"
                        strokeWidth={2}
                        fill="url(#zenithEquity)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Breakdown grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownCard
              title="By Setup"
              rows={setupBreakdown}
              icon={<Target className="w-4 h-4" />}
            />
            <BreakdownCard
              title="By Session"
              rows={sessionBreakdown}
              icon={<Activity className="w-4 h-4" />}
            />
            <BreakdownCard
              title="By Symbol"
              rows={symbolBreakdown}
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          {/* Zenith AI Depth: patterns, weekly review, NL query */}
          <ZenithDepth trades={trades} />
        </>
      )}
    </PageTransition>
  );
}

// ────────────────────────────────────────────────────────────────
//  Sub-components
// ────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-foreground-subtle uppercase tracking-wider">
            {label}
          </p>
          <span className="text-foreground-subtle">{icon}</span>
        </div>
        <p className={cn("text-2xl font-bold tabular", toneClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight }: { insight: LocalInsight }) {
  const config = {
    opportunity: {
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-profit",
      bg: "bg-profit/10",
      border: "border-profit/20",
      label: "Opportunity",
      badgeVariant: "profit" as const,
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-loss",
      bg: "bg-loss/10",
      border: "border-loss/20",
      label: "Warning",
      badgeVariant: "loss" as const,
    },
    info: {
      icon: <Lightbulb className="w-4 h-4" />,
      color: "text-info",
      bg: "bg-info/10",
      border: "border-info/20",
      label: "Insight",
      badgeVariant: "info" as const,
    },
  };
  const c = config[insight.type];

  return (
    <Card className={cn("border", c.border)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center",
                c.bg,
                c.color,
              )}
            >
              {c.icon}
            </div>
            <h3 className="text-sm font-semibold">{insight.title}</h3>
          </div>
          <Badge variant={c.badgeVariant} className="text-[10px]">
            {c.label}
          </Badge>
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed pl-9">
          {insight.description}
        </p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: import("@/lib/journal/metrics").BreakdownRow[];
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="text-foreground-subtle">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-foreground-subtle py-4 text-center">
            No data yet
          </p>
        ) : (
          rows.slice(0, 5).map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0"
            >
              <span className="text-xs font-medium truncate">{row.key}</span>
              <div className="flex items-center gap-3 text-xs tabular">
                <span className="text-foreground-subtle">{row.trades}t</span>
                <span
                  className={cn(
                    row.winRate >= 0.5 ? "text-profit" : "text-foreground-subtle",
                  )}
                >
                  {formatPercent(row.winRate, 0)}
                </span>
                <span
                  className={cn(
                    "font-medium w-16 text-right",
                    row.netPnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {formatCurrency(row.netPnl, { sign: true, compact: true })}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ZenithSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card glass className="border-brand/20">
      <CardContent className="py-16">
        <div className="text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-brand" />
          </div>
          <h2 className="text-lg font-semibold">Zenith needs data to think</h2>
          <p className="text-sm text-foreground-muted">
            Log a few trades in the Journal and Zenith will analyze your edge,
            spot patterns, and surface the #1 thing to improve. The more trades,
            the sharper the insights.
          </p>
          <a href="/dashboard/journal">
            <Button>
              <Inbox className="w-4 h-4" />
              Open Journal
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
