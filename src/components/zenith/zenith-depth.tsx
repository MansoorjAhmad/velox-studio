"use client";

/**
 * Zenith AI Depth — three new AI-powered sections for the Zenith page:
 *  1. Cross-Trade Pattern Detection (local computation, always available)
 *  2. Weekly AI Performance Review (Gemini, cached)
 *  3. Natural-Language Query box over trade history (Gemini + local fallback)
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  Calendar,
  FileText,
  Zap,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { detectPatterns, type DetectedPattern } from "@/lib/zenith/patterns";
import {
  generateWeeklyReview,
  cacheReviewSynced,
  getCachedReview,
  syncCachedReviewFromServer,
  currentWeekStart,
  type CachedReview,
} from "@/lib/zenith/weekly-review";
import { queryTradeHistory } from "@/lib/zenith/query";
import type { Trade } from "@/lib/journal/types";

interface ZenithDepthProps {
  trades: Trade[];
}

export function ZenithDepth({ trades }: ZenithDepthProps) {
  return (
    <div className="space-y-6">
      <PatternDetectionPanel trades={trades} />
      <WeeklyReviewPanel trades={trades} />
      <NaturalLanguageQuery trades={trades} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  1. CROSS-TRADE PATTERN DETECTION
// ════════════════════════════════════════════════════════════════

function PatternDetectionPanel({ trades }: { trades: Trade[] }) {
  const patterns = useMemo(() => detectPatterns(trades), [trades]);
  const edges = patterns.filter((p) => p.kind === "edge");
  const leaks = patterns.filter((p) => p.kind === "leak");
  const neutrals = patterns.filter((p) => p.kind === "neutral");

  return (
    <Card className="card-hover border-brand/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-brand" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Cross-Trade Pattern Detection
            </CardTitle>
            <CardDescription>Statistical patterns computed from your journal — no API key needed.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-border rounded-lg">
            <p className="text-xs text-foreground-subtle">
              Log more trades (10+) to unlock pattern detection. The engine analyzes post-loss behavior, time-of-day edges, hold-time habits, and more.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {edges.map((p) => (
              <PatternCard key={p.id} pattern={p} />
            ))}
            {leaks.map((p) => (
              <PatternCard key={p.id} pattern={p} />
            ))}
            {neutrals.map((p) => (
              <PatternCard key={p.id} pattern={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  const config = {
    edge: {
      icon: TrendingUp,
      color: "text-profit",
      bg: "bg-profit/10",
      border: "border-profit/20",
      badge: "profit" as const,
      label: "Edge",
    },
    leak: {
      icon: TrendingDown,
      color: "text-loss",
      bg: "bg-loss/10",
      border: "border-loss/20",
      badge: "loss" as const,
      label: "Leak",
    },
    neutral: {
      icon: Brain,
      color: "text-info",
      bg: "bg-info/10",
      border: "border-info/20",
      badge: "info" as const,
      label: "Insight",
    },
  }[pattern.kind];

  const Icon = config.icon;
  return (
    <div className={cn("rounded-lg border p-3.5", config.border, config.bg)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", config.bg, config.color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <p className="text-sm font-bold leading-tight">{pattern.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pattern.severity && (
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-1 h-1 rounded-full",
                    i < pattern.severity! ? config.color : "bg-surface-3",
                  )}
                />
              ))}
            </span>
          )}
          <Badge variant={config.badge} className="text-[9px]">{config.label}</Badge>
        </div>
      </div>
      <p className="text-xs text-foreground-muted leading-relaxed pl-8">{pattern.detail}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  2. WEEKLY AI PERFORMANCE REVIEW
// ════════════════════════════════════════════════════════════════

function WeeklyReviewPanel({ trades }: { trades: Trade[] }) {
  const weekStart = currentWeekStart();
  const [review, setReview] = useState<string | null>(() => {
    const c = getCachedReview();
    return c && c.weekStart === weekStart ? c.review : null;
  });
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState<CachedReview | null>(() => {
    const c = getCachedReview();
    return c && c.weekStart === weekStart ? c : null;
  });
  const [error, setError] = useState<string | null>(null);

  // Sync cached review from server on mount
  useEffect(() => {
    syncCachedReviewFromServer().then((synced) => {
      if (synced?.weekStart === weekStart) {
        setCached(synced);
        setReview(synced.review);
      }
    });
  }, [weekStart]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await generateWeeklyReview({
      trades,
      weekStart,
      weekEnd: new Date().toISOString().slice(0, 10),
    });
    setLoading(false);

    if (result) {
      setReview(result);
      const entry: CachedReview = {
        weekStart,
        weekEnd: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        review: result,
      };
      cacheReviewSynced(entry);
      setCached(entry);
    } else {
      setError("Couldn't reach the AI engine. Set your Gemini API key in Settings to generate weekly reviews.");
    }
  }, [trades, weekStart]);

  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-brand" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Weekly AI Performance Review
              </CardTitle>
              <CardDescription>
                Week of {weekStart} — AI-narrated strengths, leaks & next-week focus.
              </CardDescription>
            </div>
          </div>
          {!review && !loading && (
            <Button size="sm" onClick={handleGenerate}>
              <Sparkles className="w-3.5 h-3.5" />
              Generate Review
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <p className="text-xs text-foreground-subtle pt-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Zenith is reviewing your week…
            </p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button size="sm" variant="ghost" onClick={handleGenerate}>
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </Button>
          </div>
        ) : review ? (
          <div className="space-y-3">
            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground-muted [&_strong]:text-foreground [&_h2]:text-foreground [&_h2]:font-bold [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1 whitespace-pre-wrap">
              {review}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {cached && (
                <span className="text-[10px] text-foreground-subtle flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Generated {new Date(cached.generatedAt).toLocaleString()}
                </span>
              )}
              <Button size="sm" variant="ghost" onClick={handleGenerate} className="text-xs ml-auto">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Click <span className="text-foreground font-medium">Generate Review</span> to let Zenith analyze this week&apos;s trades and produce a structured performance review.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
//  3. NATURAL-LANGUAGE QUERY
// ════════════════════════════════════════════════════════════════

const SAMPLE_QUERIES = [
  "What's my best setup?",
  "Which session am I most profitable in?",
  "How do I perform after consecutive losses?",
  "What's my average R-multiple?",
];

function NaturalLanguageQuery({ trades }: { trades: Trade[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [fromAI, setFromAI] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAsk = useCallback(
    async (q?: string) => {
      const query = (q ?? question).trim();
      if (!query) return;
      setQuestion(query);
      setLoading(true);
      setAnswer(null);
      const result = await queryTradeHistory(query, trades);
      setAnswer(result.answer);
      setFromAI(result.fromAI);
      setLoading(false);
    },
    [question, trades],
  );

  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-brand" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Ask About Your Trades
            </CardTitle>
            <CardDescription>
              Ask any question in plain English — Zenith answers from your own data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Query input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="e.g. What's my win rate on breakout setups?"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
          />
          <Button size="default" onClick={() => handleAsk()} disabled={!question.trim() || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Sample queries */}
        {!answer && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface-2/50 text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Answer */}
        {loading && (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-brand" />
            <span className="text-sm text-foreground-subtle">Analyzing your trade history…</span>
          </div>
        )}
        {answer && !loading && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-bold">Zenith</span>
              <Badge variant={fromAI ? "brand" : "outline"} className="text-[9px] ml-auto">
                {fromAI ? "AI-Powered" : "Local (set API key for AI)"}
              </Badge>
            </div>
            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground-muted [&_strong]:text-foreground whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
