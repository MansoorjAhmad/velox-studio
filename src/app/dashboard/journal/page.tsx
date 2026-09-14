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
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

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
    load();
    const handleAccChange = async () => { setAccountSwitching(true); await load(); setAccountSwitching(false); };
    window.addEventListener("active_account_changed", handleAccChange);
    return () => window.removeEventListener("active_account_changed", handleAccChange);
  }, [load]);

  const handleCreate = () => {
    setEditingTrade(null);
    setFormOpen(true);
  };

  const handleEdit = (t: Trade) => {
    setEditingTrade(t);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingTrade(null);
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3 animate-stagger">
          {[
            { label: "Closed executions", value: metrics.closedTrades, icon: ScanLine, tone: "text-brand" },
            { label: "Net realized", value: `${metrics.netPnl >= 0 ? "+" : ""}${formatCurrency(metrics.netPnl)}`, icon: Target, tone: metrics.netPnl >= 0 ? "text-profit" : "text-loss" },
            { label: "Profit factor", value: metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2), icon: ShieldAlert, tone: "text-warning" },
            { label: "Current sequence", value: streak.count ? `${streak.count}${streak.type === "win" ? "W" : "L"}` : "—", icon: Flame, tone: streak.type === "win" ? "text-profit" : "text-foreground" },
          ].map((stat) => (
            <Card key={stat.label} className="card-hover">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5"><stat.icon className="w-3.5 h-3.5 text-foreground-subtle" /><span className="text-[9px] uppercase tracking-wider font-bold text-foreground-subtle">{stat.label}</span></div>
                <p className={cn("mt-2 font-mono tabular text-xl font-extrabold", stat.tone)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="lg:col-span-4 border-brand/20 card-hover">
          <CardContent className="p-4">
            <p className="text-[9px] uppercase tracking-[0.16em] text-brand font-bold">Review protocol</p>
            <p className="text-sm font-bold mt-1">Log → tag → inspect → adjust.</p>
            <p className="text-[11px] text-foreground-muted mt-1">A complete review needs setup, session, confluence, and the behavior that produced the result.</p>
          </CardContent>
        </Card>
      </div>

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
          onClose={() => {
            setFormOpen(false);
            setEditingTrade(null);
          }}
          title="Log New Trade"
        >
          <TradeForm
            onSaved={handleSaved}
            onCancel={() => {
              setFormOpen(false);
              setEditingTrade(null);
            }}
          />
        </Modal>
      )}
    </PageTransition>
  );
}
