"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TradeList } from "@/components/journal/trade-list";
import { TradeForm } from "@/components/journal/trade-form";
import { getTrades } from "@/lib/journal/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { BookOpen, Plus, Loader2 } from "lucide-react";
import type { Trade } from "@/lib/journal/types";
import { calculateMetrics, currentStreak } from "@/lib/journal/metrics";
import { cn, formatCurrency } from "@/lib/utils";
import { Target, ShieldAlert, Flame, ScanLine } from "lucide-react";
import { PageTransition } from "@/components/ui/motion";
import { getActiveAccountId } from "@/lib/accounts/active-account";

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [accountSwitching, setAccountSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const activeAccId = getActiveAccountId();
    const result = await getTrades(activeAccId);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setTrades(result.data ?? []);
    }
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const activeAccId = getActiveAccountId();
      const result = await getTrades(activeAccId);
      if (active) {
        if (result.error) {
          setError(result.error);
        } else {
          setError(null);
          setTrades(result.data ?? []);
        }
        setInitialLoad(false);
      }
    }
    init();

    const handleAccChange = async () => {
      setAccountSwitching(true);
      await load();
      setAccountSwitching(false);
    };
    window.addEventListener("active_account_changed", handleAccChange);
    return () => {
      active = false;
      window.removeEventListener("active_account_changed", handleAccChange);
    };
  }, [load]);

  const handleCreate = () => {
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    load();
  };

  const metrics = useMemo(() => calculateMetrics(trades), [trades]);
  const streak = useMemo(() => currentStreak(trades), [trades]);

  return (
    <PageTransition className="space-y-6 relative">
      {accountSwitching && <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-brand" /></div>}
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight">Trade Log</h1>
            <p className="text-sm text-foreground-muted">Your execution archive — capture the trade, then review the behavior behind it.</p>
          </div>
        </div>

        <Button onClick={handleCreate} className="bg-brand text-brand-foreground hover:bg-brand/90 font-semibold shadow-md shadow-brand/20">
          <Plus className="w-4 h-4" />
          Log Trade
        </Button>
      </div>

      {/* Executive Journal Telemetry Strip */}
      <Card className="border-border bg-surface shadow-xs card-hover">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
            <div className="px-3 py-1">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5 text-foreground-subtle" /> Executions
              </span>
              <p className="font-mono text-xl font-bold text-foreground mt-1">
                {metrics.closedTrades} <span className="text-xs font-normal text-foreground-muted">positions</span>
              </p>
            </div>

            <div className="px-3 py-1">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-foreground-subtle" /> Win Rate
              </span>
              <p className="font-mono text-xl font-bold text-foreground mt-1">
                {(metrics.winRate * 100).toFixed(1)}% <span className="text-xs font-normal text-foreground-muted">({metrics.wins}W/{metrics.losses}L)</span>
              </p>
            </div>

            <div className="px-3 py-1">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-foreground-subtle" /> Net Realized
              </span>
              <p className={cn("font-mono text-xl font-bold mt-1", metrics.netPnl >= 0 ? "text-profit" : "text-loss")}>
                {metrics.netPnl >= 0 ? "+" : ""}{formatCurrency(metrics.netPnl)}
              </p>
            </div>

            <div className="px-3 py-1">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-foreground-subtle" /> Profit Factor
              </span>
              <p className="font-mono text-xl font-bold text-foreground mt-1">
                {metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)}
              </p>
            </div>

            <div className="px-3 py-1">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-foreground-subtle" /> Run State
              </span>
              <p className={cn("font-mono text-xl font-bold mt-1", streak.type === "win" ? "text-profit" : streak.type === "loss" ? "text-loss" : "text-foreground")}>
                {streak.count ? `${streak.count} ${streak.type === "win" ? "Wins 🔥" : "Losses"}` : "Neutral"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-sm text-danger flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {initialLoad ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <TradeList trades={trades} onChanged={load} />
      )}

      {formOpen && (
        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title="Log New Trade"
        >
          <TradeForm
            onSaved={handleSaved}
            onCancel={() => setFormOpen(false)}
          />
        </Modal>
      )}
    </PageTransition>
  );
}
