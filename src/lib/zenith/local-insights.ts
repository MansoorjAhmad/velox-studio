/**
 * Local (no-Gemini) insight engine.
 * Generates structured analysis from trade metrics without any API calls.
 * Used as a fallback when Gemini is unavailable.
 */

import type { Metrics } from "@/lib/journal/metrics";
import type { BreakdownRow } from "@/lib/journal/metrics";

export interface LocalInsight {
  type: "opportunity" | "warning" | "info";
  title: string;
  description: string;
}

export function generateLocalInsights(
  metrics: Metrics,
  setupBreakdown: BreakdownRow[],
  sessionBreakdown: BreakdownRow[],
  symbolBreakdown: BreakdownRow[],
): LocalInsight[] {
  const insights: LocalInsight[] = [];

  if (metrics.closedTrades < 3) {
    return [
      {
        type: "info",
        title: "Need More Data",
        description: `You have ${metrics.closedTrades} closed trades. Log at least 10 trades to unlock meaningful pattern analysis.`,
      },
    ];
  }

  // Win rate analysis
  if (metrics.winRate >= 0.6) {
    insights.push({
      type: "opportunity",
      title: "Strong Win Rate",
      description: `Your ${Math.round(metrics.winRate * 100)}% win rate is above the 60% threshold. Focus on protecting this edge while optimizing your losers.`,
    });
  } else if (metrics.winRate < 0.4) {
    insights.push({
      type: "warning",
      title: "Win Rate Below Threshold",
      description: `At ${Math.round(metrics.winRate * 100)}%, your win rate is below 40%. Consider tightening your entry criteria or reducing trade frequency.`,
    });
  }

  // Profit factor
  if (metrics.profitFactor === Infinity && metrics.grossProfit > 0) {
    insights.push({
      type: "opportunity",
      title: "Zero Loss Record",
      description: "You have recorded no losing trades yet. Profit factor will establish as more trades are logged.",
    });
  } else if (isFinite(metrics.profitFactor) && metrics.profitFactor >= 2) {
    insights.push({
      type: "opportunity",
      title: "Excellent Profit Factor",
      description: `Your profit factor of ${metrics.profitFactor.toFixed(2)} is elite. You're making $${metrics.profitFactor.toFixed(2)} for every $1 lost.`,
    });
  } else if (metrics.profitFactor > 0 && metrics.profitFactor < 1.2) {
    insights.push({
      type: "warning",
      title: "Thin Profit Factor",
      description: `A ${metrics.profitFactor.toFixed(2)} profit factor means you're barely covering your losers. Focus on holding winners longer or cutting losers faster.`,
    });
  }

  // R-multiple
  if (metrics.avgRMultiple > 1.5) {
    insights.push({
      type: "opportunity",
      title: "Positive R-Edge",
      description: `Your average R-multiple of ${metrics.avgRMultiple.toFixed(2)} shows consistent risk-adjusted returns. Scale this strategy.`,
    });
  } else if (metrics.avgRMultiple < 0.5 && metrics.avgRMultiple > -0.5) {
    insights.push({
      type: "warning",
      title: "Flat R-Multiple",
      description: `Average R of ${metrics.avgRMultiple.toFixed(2)} means your winners barely beat your risk per trade. Raise your targets or tighten stops.`,
    });
  }

  // Best/worst setup
  if (setupBreakdown.length >= 2) {
    const best = setupBreakdown[0];
    const worst = setupBreakdown[setupBreakdown.length - 1];
    insights.push({
      type: "opportunity",
      title: `Best Setup: ${best.key}`,
      description: `${best.key} has a ${Math.round(best.winRate * 100)}% win rate across ${best.trades} trades with $${best.netPnl.toFixed(0)} net P&L.`,
    });
    if (worst.netPnl < 0) {
      insights.push({
        type: "warning",
        title: `Weakest Setup: ${worst.key}`,
        description: `${worst.key} is bleeding $${Math.abs(worst.netPnl).toFixed(0)} with a ${Math.round(worst.winRate * 100)}% win rate. Consider pausing this setup.`,
      });
    }
  }

  // Session analysis
  if (sessionBreakdown.length >= 2) {
    const bestSession = sessionBreakdown[0];
    insights.push({
      type: "info",
      title: `${bestSession.key} Session Edge`,
      description: `Your strongest session is ${bestSession.key} with ${Math.round(bestSession.winRate * 100)}% accuracy and $${bestSession.netPnl.toFixed(0)} P&L.`,
    });
  }

  // Streak analysis
  if (metrics.maxLossStreak >= 3) {
    insights.push({
      type: "warning",
      title: "Loss Streak Risk",
      description: `You've had a ${metrics.maxLossStreak}-trade loss streak. After 3 losses, take a 15-minute break before your next trade.`,
    });
  }

  // Expectancy
  if (metrics.expectancy < 0) {
    insights.push({
      type: "warning",
      title: "Negative Expectancy",
      description: `Your average trade loses $${Math.abs(metrics.expectancy).toFixed(2)}. Reduce position size or improve your setup selection until expectancy turns positive.`,
    });
  }

  return insights;
}
