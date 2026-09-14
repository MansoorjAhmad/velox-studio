"use client";

/**
 * Trader Index page — dedicated view for the discipline score, sub-scores,
 * rule-violation feed, and explanatory context.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TraderIndexGauge } from "@/components/dashboard/trader-index-gauge";
import { RuleAlerts } from "@/components/dashboard/rule-alerts";
import { getTrades } from "@/lib/journal/actions";
import { calculateTraderIndex } from "@/lib/journal/trader-index";
import { getTradingConfig } from "@/lib/trading-config";
import { Shield, BookOpen, Brain, Flame, Loader2 } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import type { Trade } from "@/lib/journal/types";
import { getActiveAccountId } from "@/lib/accounts/active-account";

export function TraderIndexPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [accountSwitching, setAccountSwitching] = useState(false);

  const load = useCallback(async () => {
    const activeAccId = getActiveAccountId();
    const res = await getTrades(activeAccId);
    setTrades(res.data ?? []);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    load();
    const h = async () => { setAccountSwitching(true); await load(); setAccountSwitching(false); };
    window.addEventListener("active_account_changed", h);
    return () => window.removeEventListener("active_account_changed", h);
  }, [load]);

  const result = useMemo(
    () => calculateTraderIndex(trades, getTradingConfig()),
    [trades],
  );

  if (initialLoad) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const { breakdown, alerts } = result;

  return (
    <PageTransition className="space-y-6 relative">
      {accountSwitching && <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-brand" /></div>}
      {/* Header */}
      <FadeIn>
        <div className="glass-subtle rounded-xl border border-border/60 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Trader Index</h1>
            <p className="text-xs text-foreground-muted">
              A discipline score — not a profitability score. Profitable-but-reckless never lasts.
            </p>
          </div>
        </div>
      </FadeIn>

      {trades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Shield className="w-12 h-12 text-foreground-subtle/30 mx-auto mb-3" />
            <p className="text-sm font-semibold">No trades to score yet</p>
            <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
              Log trades with stop-losses, setups, and emotions to generate your discipline score.
              The index sharpens as your journal grows.
            </p>
            <a href="/dashboard/journal" className="inline-block mt-4 text-xs font-semibold text-brand hover:underline">
              Open Trade Log →
            </a>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gauge + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TraderIndexGauge breakdown={breakdown} />
            <div className="lg:col-span-2">
              <RuleAlerts alerts={alerts} />
            </div>
          </div>

          {/* Pillar explanations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PillarCard
              icon={Shield}
              title="Risk Consistency"
              score={breakdown.riskConsistency}
              description="Measures R-multiple variance and oversized-risk detection against your phase risk rules."
            />
            <PillarCard
              icon={BookOpen}
              title="Rule Adherence"
              score={breakdown.ruleAdherence}
              description="Tracks missing stop-losses, self-tagged mistakes, and unclassified trades against TOPG risk rules."
            />
            <PillarCard
              icon={Brain}
              title="Emotional Control"
              score={breakdown.emotionalControl}
              description="Compares win rate under calm vs reactive emotional states (revenge, fomo, anxious)."
            />
            <PillarCard
              icon={Flame}
              title="Revenge Discipline"
              score={breakdown.revengeDiscipline}
              description="Detects oversized positions and rapid-fire entries within 60 minutes of a loss."
            />
          </div>
        </>
      )}
    </PageTransition>
  );
}

function PillarCard({
  icon: Icon,
  title,
  score,
  description,
}: {
  icon: React.ElementType;
  title: string;
  score: number;
  description: string;
}) {
  const tone = score >= 80 ? "text-profit" : score >= 60 ? "text-brand" : score >= 40 ? "text-warning" : "text-loss";
  return (
    <Card className="card-hover glass-subtle">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="w-7 h-7 rounded-md bg-surface-2 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-foreground-subtle" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">{title}</span>
        </div>
        <p className={cnTone(tone, "text-2xl font-extrabold font-mono tabular")}>{score}</p>
        <p className="text-[10px] text-foreground-muted mt-1.5 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

// Local helper to avoid importing cn twice with conditional logic.
function cnTone(tone: string, base: string): string {
  return `${base} ${tone}`;
}
