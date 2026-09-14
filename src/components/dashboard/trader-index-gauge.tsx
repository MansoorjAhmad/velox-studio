"use client";

/**
 * TraderIndexGauge — animated radial gauge for the composite discipline score.
 * Shows the overall 0–100 score with a letter grade and a color that shifts
 * from red (poor) → amber → green (elite).
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TraderIndexBreakdown } from "@/lib/journal/trader-index";

interface TraderIndexGaugeProps {
  breakdown: TraderIndexBreakdown;
}

export function TraderIndexGauge({ breakdown }: TraderIndexGaugeProps) {
  const reduce = useReducedMotion();
  const { overall, grade, riskConsistency, ruleAdherence, emotionalControl, revengeDiscipline } = breakdown;

  // Animate the arc fill.
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(eased * overall));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overall, reduce]);

  const displayedScore = reduce ? overall : animatedScore;

  // Color based on score.
  const tier =
    overall >= 80 ? "elite" : overall >= 65 ? "good" : overall >= 45 ? "fair" : "poor";
  const tierConfig = {
    elite: { color: "var(--profit)", stroke: "var(--profit)", label: "Elite Discipline", icon: ShieldCheck, textClass: "text-profit" },
    good:  { color: "var(--brand)", stroke: "var(--brand)", label: "Solid Discipline", icon: ShieldCheck, textClass: "text-brand" },
    fair:  { color: "var(--warning)", stroke: "var(--warning)", label: "Developing", icon: ShieldAlert, textClass: "text-warning" },
    poor:  { color: "var(--loss)", stroke: "var(--loss)", label: "Needs Work", icon: ShieldX, textClass: "text-loss" },
  }[tier];
  const TierIcon = tierConfig.icon;

  // Conic gradient: the arc represents score/100 of the circle.
  const arcDeg = (displayedScore / 100) * 360;

  const segments = [
    { label: "Risk Consistency", value: riskConsistency, color: "bg-brand" },
    { label: "Rule Adherence", value: ruleAdherence, color: "bg-profit" },
    { label: "Emotional Control", value: emotionalControl, color: "bg-info" },
    { label: "Revenge Discipline", value: revengeDiscipline, color: "bg-warning" },
  ];

  return (
    <Card className="card-hover h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            Trader Index
          </span>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", tierConfig.textClass)}>
            {tierConfig.label}
          </span>
        </CardTitle>
        <CardDescription>Composite discipline score from your trade data.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-center py-2">
          <div className="relative w-36 h-36">
            {/* Animated arc */}
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={reduce ? false : { rotate: -90 }}
              animate={{ rotate: -90 }}
              style={{
                background: `conic-gradient(${tierConfig.stroke} 0deg ${arcDeg}deg, #1c1c21 ${arcDeg}deg 360deg)`,
              }}
            />
            {/* Center hole */}
            <div className="absolute inset-[14px] rounded-full bg-surface flex items-center justify-center">
              <div className="text-center">
                <TierIcon className={cn("w-5 h-5 mx-auto mb-0.5", tierConfig.textClass)} />
                <span className={cn("text-3xl font-extrabold font-mono tabular leading-none", tierConfig.textClass)}>
                  {displayedScore}
                </span>
                <span className="text-[10px] text-foreground-subtle block mt-0.5">Grade {grade}</span>
              </div>
            </div>
            {/* Glow */}
            <div
              className="absolute -inset-1 rounded-full opacity-20 blur-md pointer-events-none"
              style={{ background: `conic-gradient(${tierConfig.stroke} 0deg ${arcDeg}deg, transparent ${arcDeg}deg 360deg)` }}
            />
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-2 mt-3">
          {segments.map((m, i) => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-foreground-subtle">{m.label}</span>
                <span className="font-mono font-bold tabular">{m.value}</span>
              </div>
              <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", m.color)}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${m.value}%` }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Alert summary */}
        {(breakdown.alertCounts.critical > 0 || breakdown.alertCounts.warning > 0) && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-[10px]">
            {breakdown.alertCounts.critical > 0 && (
              <span className="flex items-center gap-1 text-loss font-semibold">
                <ShieldX className="w-3 h-3" />
                {breakdown.alertCounts.critical} critical
              </span>
            )}
            {breakdown.alertCounts.warning > 0 && (
              <span className="flex items-center gap-1 text-warning font-semibold">
                <ShieldAlert className="w-3 h-3" />
                {breakdown.alertCounts.warning} warnings
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
