"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Circle,
  ImagePlus,
  Loader2,
  NotebookPen,
  Search,
  Trash2,
  ShieldCheck,
  Brain,
  FileText,
  Camera,
  Maximize2,
  X,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getTrades, updateTrade } from "@/lib/journal/actions";
import { getActiveAccountId } from "@/lib/accounts/active-account";
import { COMMON_EMOTIONS } from "@/lib/journal/types";
import type { Trade } from "@/lib/journal/types";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { PageTransition } from "@/components/ui/motion";

const DEFAULT_CHECKLIST = [
  "Checked higher timeframe trend",
  "Risk strictly within position limits",
  "Setup strictly adheres to trading plan",
  "Key liquidity levels identified",
  "Economic calendar & news events cleared",
  "Stop-loss was pre-calculated & placed",
];

type JournalFilter = "all" | "journaled" | "pending";
type ChecklistItem = { label: string; checked: boolean };
type MobileTab = "trades" | "review";

function calculateRR(trade: Trade) {
  if (trade.stop_loss == null || trade.take_profit == null || trade.entry_price == null) return "—";
  const risk = Math.abs(trade.entry_price - trade.stop_loss);
  const reward = Math.abs(trade.take_profit - trade.entry_price);
  return risk > 0 && Number.isFinite(reward / risk) ? `1 : ${(reward / risk).toFixed(2)}` : "—";
}

export default function JournalReviewPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<JournalFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("trades");

  const loadTrades = useCallback(async () => {
    setLoading(true);
    const activeAccId = getActiveAccountId();
    const result = await getTrades(activeAccId);
    const rows = result.data ?? [];
    setTrades(rows);
    setSelectedId((current) => (rows.some((r) => r.id === current) ? current : rows[0]?.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const activeAccId = getActiveAccountId();
      const result = await getTrades(activeAccId);
      if (active) {
        const rows = result.data ?? [];
        setTrades(rows);
        setSelectedId((current) => (rows.some((r) => r.id === current) ? current : rows[0]?.id));
        setLoading(false);
      }
    }
    init();

    const handleAccChange = () => {
      loadTrades();
    };
    window.addEventListener("active_account_changed", handleAccChange);
    return () => {
      active = false;
      window.removeEventListener("active_account_changed", handleAccChange);
    };
  }, [loadTrades]);

  const selected = trades.find((trade) => trade.id === selectedId);
  const visible = useMemo(
    () =>
      trades.filter(
        (trade) =>
          (filter === "journaled"
            ? !!trade.journaled_at
            : filter === "pending"
            ? !trade.journaled_at
            : true) &&
          (trade.symbol.toLowerCase().includes(query.toLowerCase()) ||
            trade.setup?.toLowerCase().includes(query.toLowerCase()))
      ),
    [trades, filter, query]
  );

  const counts = {
    all: trades.length,
    journaled: trades.filter((t) => t.journaled_at).length,
    pending: trades.filter((t) => !t.journaled_at).length,
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Journal &amp; Mindset Review
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-foreground-muted">
            The psychological and forensic debrief of your executions. Uncover behavioral tilt, plan adherence, and lessons learned.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-foreground-subtle bg-surface px-3 py-1.5 rounded-lg border border-border">
          <span>{counts.journaled} Reviewed</span>
          <span className="text-border">|</span>
          <span className="text-warning">{counts.pending} Awaiting Review</span>
        </div>
      </div>

      {/* ── Mobile Tab Bar (hidden on lg+) ── */}
      <div className="lg:hidden flex rounded-xl border border-border bg-surface-2 p-1 text-xs font-mono font-semibold">
        <button
          onClick={() => setMobileTab("trades")}
          className={cn(
            "flex-1 rounded-lg py-2 text-center transition-colors",
            mobileTab === "trades"
              ? "bg-surface text-foreground font-bold shadow-xs"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          Trades ({visible.length})
        </button>
        <button
          onClick={() => setMobileTab("review")}
          className={cn(
            "flex-1 rounded-lg py-2 text-center transition-colors",
            mobileTab === "review"
              ? "bg-surface text-foreground font-bold shadow-xs"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          Review {selected ? `· ${selected.symbol}` : ""}
        </button>
      </div>

      {/* ── Desktop: side-by-side grid. Mobile: tab-controlled single column ── */}
      <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)] items-start">
        {/* Left Sidebar — Trade Selector */}
        <Card className={cn(
          "h-fit lg:sticky lg:top-20 border-border bg-surface shadow-xs",
          "lg:block",
          mobileTab === "trades" ? "block" : "hidden"
        )}>
          <CardHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase font-mono font-bold tracking-wider text-foreground-subtle">
                Executions
              </CardTitle>
              <span className="text-[11px] font-mono text-foreground-subtle">
                {visible.length} of {trades.length}
              </span>
            </div>

            {/* Segmented Filter */}
            <div className="grid grid-cols-3 rounded-lg bg-surface-2 p-1 text-[11px] font-mono font-semibold mt-2.5">
              {(["all", "pending", "journaled"] as JournalFilter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-md py-1.5 capitalize transition-colors text-center",
                    filter === item
                      ? "bg-surface text-foreground font-bold shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  {item} ({counts[item]})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mt-2.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-subtle" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8 h-8 text-xs bg-surface-2/60 border-border/80"
                placeholder="Filter symbol or setup…"
              />
            </div>
          </CardHeader>

          <CardContent className="p-2">
            <div className="max-h-[60svh] space-y-1.5 overflow-y-auto pr-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-foreground-muted flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  <span>Loading executions…</span>
                </div>
              ) : (
                visible.map((trade) => {
                  const isSelected = selectedId === trade.id;
                  const isProfit = (trade.pnl ?? 0) > 0;
                  const isLoss = (trade.pnl ?? 0) < 0;
                  return (
                    <button
                      key={trade.id}
                      onClick={() => {
                        setSelectedId(trade.id);
                        setMobileTab("review"); // auto-switch on mobile
                      }}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all relative block",
                        isSelected
                          ? "border-foreground/50 bg-surface-2/90 shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-surface-2/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-sm text-foreground">
                            {trade.symbol}
                          </span>
                          <Badge
                            variant={trade.direction === "LONG" ? "profit" : "loss"}
                            className="text-[9px] font-mono"
                          >
                            {trade.direction}
                          </Badge>
                        </div>
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            isProfit && "text-profit",
                            isLoss && "text-loss",
                            !isProfit && !isLoss && "text-foreground-muted"
                          )}
                        >
                          {trade.pnl != null ? formatCurrency(trade.pnl, { sign: true }) : "—"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-foreground-muted font-mono">
                        <span className="truncate max-w-[140px]">{trade.setup || "No Setup"}</span>
                        <span>{new Date(trade.entry_time).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] pt-1.5 border-t border-border/40 font-mono">
                        <div className="flex items-center gap-1">
                          {trade.journaled_at ? (
                            <span className="text-profit flex items-center gap-1 font-semibold">
                              <Check className="h-3 w-3" /> Reviewed
                            </span>
                          ) : (
                            <span className="text-warning flex items-center gap-1 font-medium">
                              <Circle className="h-2 w-2 fill-warning" /> Pending
                            </span>
                          )}
                        </div>
                        {trade.r_multiple != null && (
                          <span className={trade.r_multiple >= 0 ? "text-profit" : "text-loss"}>
                            {trade.r_multiple > 0 ? "+" : ""}{trade.r_multiple.toFixed(1)}R
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}

              {!loading && visible.length === 0 && (
                <div className="py-10 text-center text-xs text-foreground-muted">
                  No executions matching filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Main Content — The 4-Phase Review Workspace */}
        <div className={cn(
          "lg:block",
          mobileTab === "review" ? "block" : "hidden"
        )}>
          {/* Mobile back button */}
          <button
            onClick={() => setMobileTab("trades")}
            className="lg:hidden flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground font-mono mb-3 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to trades
          </button>

          {selected ? (
            <JournalForm
              key={selected.id}
              trade={selected}
              onSaved={(next) =>
                setTrades((current) =>
                  current.map((trade) => (trade.id === next.id ? next : trade))
                )
              }
            />
          ) : (
            <Card className="border-border bg-surface shadow-xs">
              <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
                  <NotebookPen className="h-6 w-6 text-foreground-subtle" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Select an execution to review
                  </h3>
                  <p className="text-xs text-foreground-muted mt-1 max-w-sm">
                    Select any completed trade from the left sidebar to analyze pre-trade psychology, adherence checklists, and post-mortem charts.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </PageTransition>
  );
}

function JournalForm({
  trade,
  onSaved,
}: {
  trade: Trade;
  onSaved: (trade: Trade) => void;
}) {
  const [pre, setPre] = useState(trade.pre_trade_analysis ?? "");
  const [post, setPost] = useState(trade.post_trade_review ?? "");
  const [lessons, setLessons] = useState(trade.lessons_learned ?? "");
  const [before, setBefore] = useState<string[]>(trade.emotion_before ?? []);
  const [after, setAfter] = useState<string[]>(trade.emotion_after ?? []);
  const [tags, setTags] = useState((trade.confluences ?? []).join(", "));
  const [confidence, setConfidence] = useState(trade.confidence ?? 5);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paths, setPaths] = useState<string[]>(trade.screenshot_urls ?? []);
  const [images, setImages] = useState<{ path: string; url: string }[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    (trade.execution_checklist?.length
      ? trade.execution_checklist
      : DEFAULT_CHECKLIST.map((label) => ({ label, checked: false }))) as ChecklistItem[]
  );

  useEffect(() => {
    const loadImages = async () => {
      if (!paths.length) return setImages([]);
      const client = createClient();
      const { data } = await client.storage.from("trade-screenshots").createSignedUrls(paths, 3600);
      const signed: { path: string; url: string }[] = [];
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) signed.push({ path: row.path, url: row.signedUrl });
      }
      setImages(signed);
    };
    loadImages();
  }, [paths]);

  const toggleEmotion = (value: string, setter: (values: string[]) => void, values: string[]) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const save = async () => {
    setSaving(true);
    const confluencesArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const result = await updateTrade(trade.id, {
      pre_trade_analysis: pre,
      post_trade_review: post,
      lessons_learned: lessons,
      emotion_before: before,
      emotion_after: after,
      confidence,
      confluences: confluencesArray,
      execution_checklist: checklist,
      screenshot_urls: paths,
      journaled_at: trade.journaled_at ?? new Date().toISOString(),
    });

    setSaving(false);
    if (result.error) return toast.error(result.error);

    const next: Trade = {
      ...trade,
      pre_trade_analysis: pre,
      post_trade_review: post,
      lessons_learned: lessons,
      emotion_before: before,
      emotion_after: after,
      confidence,
      confluences: confluencesArray,
      execution_checklist: checklist,
      screenshot_urls: paths,
      journaled_at: trade.journaled_at ?? new Date().toISOString(),
    };
    onSaved(next);
    toast.success("Execution review saved");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      setUploading(false);
      return toast.error("Please sign in again.");
    }

    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files are supported.");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Images must be under 8 MB.");
        continue;
      }
      const path = `${user.id}/${trade.id}/${crypto.randomUUID()}-${file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      )}`;
      const { error } = await client.storage.from("trade-screenshots").upload(path, file, {
        upsert: false,
      });
      if (error) toast.error(error.message);
      else uploaded.push(path);
    }
    setPaths((current) => [...current, ...uploaded]);
    setUploading(false);
  };

  const removeImage = async (path: string) => {
    const client = createClient();
    const { error } = await client.storage.from("trade-screenshots").remove([path]);
    if (error) return toast.error(error.message);
    setPaths((current) => current.filter((item) => item !== path));
  };

  const isProfit = (trade.pnl ?? 0) > 0;
  const isLoss = (trade.pnl ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Context Banner & Action Bar */}
      <Card className="border-border bg-surface shadow-xs overflow-hidden">
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-2xl font-bold text-foreground">{trade.symbol}</h2>
              <Badge
                variant={trade.direction === "LONG" ? "profit" : "loss"}
                className="font-mono text-xs font-bold"
              >
                {trade.direction}
              </Badge>
              {trade.journaled_at ? (
                <Badge variant="brand" className="text-[10px] font-mono">
                  Reviewed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-mono text-warning border-warning/30">
                  Pending Review
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted font-mono">
              <span>Entry: ${trade.entry_price?.toFixed(2) ?? "—"}</span>
              <span className="text-border">|</span>
              <span>Exit: ${trade.exit_price?.toFixed(2) ?? "—"}</span>
              <span className="text-border">|</span>
              <span>Size: {trade.quantity} lots</span>
              <span className="text-border">|</span>
              <span className={cn("font-bold", isProfit && "text-profit", isLoss && "text-loss")}>
                P&amp;L: {trade.pnl != null ? formatCurrency(trade.pnl, { sign: true }) : "—"}
              </span>
              <span className="text-border">|</span>
              <span className="text-brand font-bold">Planned R:R: {calculateRR(trade)}</span>
            </div>
          </div>

          <Button
            onClick={save}
            disabled={saving}
            className="font-semibold text-xs h-10 px-5 bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-xs"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Review
          </Button>
        </CardContent>
      </Card>

      {/* Phase 1: Mindset & Psychological Forensics */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-brand" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Phase 01 · Psychological Forensics &amp; Mindset
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Capture emotional state shifts between trade inception and resolution to train emotional resilience.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Emotion Before */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-subtle block">
                Pre-Execution State (Before Entering)
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_EMOTIONS.map((emotion) => {
                  const active = before.includes(emotion);
                  return (
                    <button
                      type="button"
                      key={`before-${emotion}`}
                      onClick={() => toggleEmotion(emotion, setBefore, before)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize",
                        active
                          ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                          : "bg-surface-2 text-foreground-muted border-border hover:text-foreground"
                      )}
                    >
                      {emotion}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emotion After */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-subtle block">
                Post-Execution State (After Exit)
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_EMOTIONS.map((emotion) => {
                  const active = after.includes(emotion);
                  return (
                    <button
                      type="button"
                      key={`after-${emotion}`}
                      onClick={() => toggleEmotion(emotion, setAfter, after)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize",
                        active
                          ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                          : "bg-surface-2 text-foreground-muted border-border hover:text-foreground"
                      )}
                    >
                      {emotion}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Execution Confidence Slider */}
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-foreground uppercase tracking-wider">
                Execution Quality Rating (Not P&amp;L Based)
              </span>
              <span className="font-bold text-brand text-sm">{confidence} / 10</span>
            </div>
            <Slider
              label="Quality Rating"
              min={1}
              max={10}
              step={1}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />
            <p className="text-[11px] text-foreground-subtle mt-2">
              Rate your adherence to plan and execution discipline. A losing trade executed strictly by the rules is a 10/10.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Phase 2: Execution Checklist & Confluences */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-profit" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Phase 02 · Execution Checklist &amp; Rule Adherence
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Verify protocol compliance prior to position exposure.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((item, index) => (
              <label
                key={`${item.label}-${index}`}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors cursor-pointer select-none",
                  item.checked
                    ? "border-profit/40 bg-profit/8 text-foreground"
                    : "border-border bg-surface-2/30 text-foreground-muted hover:border-border-strong"
                )}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() =>
                    setChecklist((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, checked: !entry.checked } : entry
                      )
                    )
                  }
                  className="mt-0.5 rounded border-border accent-profit cursor-pointer"
                />
                <span className="font-medium leading-snug">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Add custom rule (e.g. London Sweep confirmed)..."
              className="text-xs h-9 bg-surface-2/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  e.preventDefault();
                  setChecklist((current) => [...current, { label: custom.trim(), checked: false }]);
                  setCustom("");
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (custom.trim()) {
                  setChecklist((current) => [...current, { label: custom.trim(), checked: false }]);
                  setCustom("");
                }
              }}
              className="text-xs font-semibold gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </Button>
          </div>

          {/* Confluences & Setup Tags */}
          <div className="pt-3 border-t border-border/60">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-subtle block mb-1.5">
              Confluence &amp; Setup Tags
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Liquidity Sweep, FVG, 15M Inversion, NY Open"
              className="text-xs h-9 bg-surface-2/40 font-mono"
            />
            <p className="text-[11px] text-foreground-subtle mt-1.5">
              Separate tags with commas. Used by the Confluence Edge Matrix and Zenith AI.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Phase 3: Trade Thesis & Post-Mortem Analysis */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-foreground" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Phase 03 · Written Thesis &amp; Post-Mortem
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Document your reasoning clearly to separate variance from systematic error.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Pre-Trade Thesis &amp; Model
              </label>
              <Textarea
                value={pre}
                onChange={(e) => setPre(e.target.value)}
                placeholder="What was the technical setup, higher timeframe bias, catalyst, and invalidation criteria?"
                className="min-h-32 text-xs leading-relaxed bg-surface-2/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Post-Trade Review &amp; Execution
              </label>
              <Textarea
                value={post}
                onChange={(e) => setPost(e.target.value)}
                placeholder="What actually took place? Did you manage according to plan or exit prematurely?"
                className="min-h-32 text-xs leading-relaxed bg-surface-2/30"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
              Lessons Learned &amp; Rule Refinement
            </label>
            <Textarea
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              placeholder="What is the single most important actionable rule to remember from this trade?"
              className="min-h-24 text-xs leading-relaxed bg-surface-2/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 4: Evidence & Chart Screenshot Lightbox */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-brand" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                Phase 04 · Chart Evidence &amp; Visual Lightbox
              </CardTitle>
            </div>
            <span className="text-[11px] font-mono text-foreground-subtle">
              {images.length} Captured
            </span>
          </div>
          <CardDescription className="text-xs">
            Store pre-entry and post-exit charts. Encrypted and sovereign to your database.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3">
            {images.map((image) => (
              <div
                key={image.path}
                className="group relative h-28 w-36 overflow-hidden rounded-xl border border-border bg-surface-2 cursor-pointer shadow-xs"
                onClick={() => setLightboxUrl(image.url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt="Chart execution screenshot"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="p-1.5 rounded-md bg-white/20 text-white hover:bg-white/40">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(image.path);
                    }}
                    className="p-1.5 rounded-md bg-loss/80 text-white hover:bg-loss"
                    title="Delete image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <label className="flex h-28 w-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-xs text-foreground-muted hover:border-foreground-muted hover:text-foreground transition-all">
              <ImagePlus className="h-5 w-5 text-foreground-subtle" />
              <span>{uploading ? "Uploading…" : "Add chart"}</span>
              <input
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => upload(e.target.files)}
              />
            </label>
          </div>
          <p className="mt-3 text-[11px] text-foreground-subtle font-mono">
            Supported formats: PNG, JPG, WebP up to 8 MB. Click thumbnail to inspect full resolution.
          </p>
        </CardContent>
      </Card>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Expanded chart view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
