"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

import {
  CONFLUENCE_TAGS,
  COMMON_EMOTIONS,
  SESSIONS,
  computeRMultiple,
  type TradeInput,
} from "@/lib/journal/types";
import { createTrade, updateTrade } from "@/lib/journal/actions";
import { getTradingAccounts } from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getCustomStrategies, subscribeStrategiesListener } from "@/lib/journal/strategies";
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Check,
  Plus,
  X,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAccountId } from "@/lib/accounts/active-account";

const EMOTIONS = [...COMMON_EMOTIONS];

type PartialRow = { price: string; lots: string };

export function TradeForm({
  initial,
  tradeId,
  onSaved,
  onCancel,
}: {
  initial?: Partial<TradeInput>;
  tradeId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountId] = useState<string>(initial?.account_id ?? "");

  useEffect(() => {
    const loadAccs = async () => {
      const res = await getTradingAccounts();
      const list = res.data ?? [];
      setAccounts(list);

      if (!initial?.account_id) {
        const activeId = getActiveAccountId();
        if (activeId && activeId !== "all" && list.some((a) => a.id === activeId)) {
          setAccountId(activeId);
        } else if (list.length > 0) {
          const defaultAcc = list.find((a) => a.is_default) ?? list[0];
          setAccountId(defaultAcc.id);
        }
      }
    };
    loadAccs();
  }, [initial]);

  const [direction, setDirection] = useState<"LONG" | "SHORT">(
    initial?.direction ?? "LONG",
  );
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [entryPrice, setEntryPrice] = useState<string>(
    initial?.entry_price?.toString() ?? "",
  );
  const [exitPrice, setExitPrice] = useState<string>(
    initial?.exit_price?.toString() ?? "",
  );
  const [stopLoss, setStopLoss] = useState<string>(
    initial?.stop_loss?.toString() ?? "",
  );
  const [takeProfit, setTakeProfit] = useState<string>(
    initial?.take_profit?.toString() ?? "",
  );
  const [quantity, setQuantity] = useState<string>(
    initial?.quantity?.toString() ?? "1",
  );
  const [pnl, setPnl] = useState<string>(initial?.pnl?.toString() ?? "");
  const [status, setStatus] = useState<TradeInput["status"]>(
    initial?.status ?? "closed",
  );
  const [setup, setSetup] = useState<string>(initial?.setup ?? "");
  const [session, setSession] = useState<string>(initial?.session ?? "");
  const [marketCondition, setMarketCondition] = useState(
    initial?.market_condition ?? "",
  );
  const [confidence, setConfidence] = useState<number>(initial?.confidence ?? 5);
  const [emotionBefore, setEmotionBefore] = useState<string[]>(
    initial?.emotion_before ?? [],
  );
  const emotionAfter = initial?.emotion_after ?? [];
  const mistakes = initial?.mistakes ?? [];
  const mae = initial?.mae?.toString() ?? "";
  const mfe = initial?.mfe?.toString() ?? "";
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [entryTime, setEntryTime] = useState(
    (initial?.entry_time ?? new Date().toISOString()).slice(0, 16),
  );
  const [exitTime, setExitTime] = useState(
    initial?.exit_time ? initial.exit_time.slice(0, 16) : "",
  );

  // Progressive disclosure accordion state
  const hasExistingAdvancedData = Boolean(
    (initial?.confluences && initial.confluences.length > 0) ||
    (initial?.emotion_before && initial.emotion_before.length > 0) ||
    (initial?.emotion_after && initial.emotion_after.length > 0) ||
    (initial?.mistakes && initial.mistakes.length > 0) ||
    (initial?.notes && initial.notes.trim()) ||
    (initial?.partials && initial.partials.length > 0) ||
    initial?.mae != null ||
    initial?.mfe != null
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(hasExistingAdvancedData);

  // ── Partial TP mode ──
  const [partialMode, setPartialMode] = useState<boolean>(
    Array.isArray(initial?.partials) && (initial!.partials!.length ?? 0) > 0,
  );
  const [partials, setPartials] = useState<PartialRow[]>(
    Array.isArray(initial?.partials) && initial!.partials!.length
      ? initial!.partials!.map((p) => ({
          price: p.price?.toString() ?? "",
          lots: p.lots?.toString() ?? "",
        }))
      : [{ price: "", lots: "" }],
  );

  // ── Confluences ──
  const [confluences, setConfluences] = useState<string[]>(
    initial?.confluences ?? [],
  );

  const [setupsList, setSetupsList] = useState<string[]>(getCustomStrategies());

  useEffect(() => {
    return subscribeStrategiesListener(() => {
      setSetupsList(getCustomStrategies());
    });
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Auto-computed weighted exit + combined P&L from partials ──
  const partialComputation = useMemo(() => {
    if (!partialMode) return null;
    const valid = partials
      .map((p) => ({ price: parseFloat(p.price), lots: parseFloat(p.lots) }))
      .filter((p) => !isNaN(p.price) && !isNaN(p.lots) && p.lots > 0);
    if (valid.length === 0) return null;

    const totalLots = valid.reduce((s, p) => s + p.lots, 0);
    const weightedSum = valid.reduce((s, p) => s + p.price * p.lots, 0);
    const weightedExit = weightedSum / totalLots;

    const entry = parseFloat(entryPrice);
    let combinedPnl = NaN;
    if (!isNaN(entry)) {
      const diff = valid.reduce((s, p) => s + (p.price - entry) * p.lots, 0);
      combinedPnl = direction === "LONG" ? diff : -diff;
    }

    return {
      weightedExit: Math.round(weightedExit * 100000) / 100000,
      totalLots: Math.round(totalLots * 100000) / 100000,
      combinedPnl: isNaN(combinedPnl) ? null : Math.round(combinedPnl * 100) / 100,
    };
  }, [partialMode, partials, entryPrice, direction]);

  const effectiveExit = partialMode && partialComputation
    ? partialComputation.weightedExit.toString()
    : exitPrice;
  const effectivePnl = partialMode && partialComputation?.combinedPnl != null
    ? partialComputation.combinedPnl.toString()
    : pnl;

  const rMultiple = useMemo(() => {
    const e = parseFloat(entryPrice);
    const s = parseFloat(stopLoss);
    const x = parseFloat(effectiveExit);
    if (isNaN(e) || isNaN(s) || isNaN(x)) return null;
    return computeRMultiple(e, s, x, direction);
  }, [entryPrice, stopLoss, effectiveExit, direction]);

  const toggleArray = (
    arr: string[],
    setArr: (v: string[]) => void,
    item: string,
  ) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const updatePartial = (idx: number, field: keyof PartialRow, val: string) => {
    setPartials((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    );
  };
  const addPartial = () =>
    setPartials((prev) => [...prev, { price: "", lots: "" }]);
  const removePartial = (idx: number) =>
    setPartials((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!symbol.trim()) {
      setError("Symbol is required.");
      setSaving(false);
      return;
    }
    if (isNaN(parseFloat(entryPrice))) {
      setError("Entry price is required.");
      setSaving(false);
      return;
    }

    const partialsPayload =
      partialMode && partialComputation
        ? partials
            .map((p) => ({
              price: parseFloat(p.price),
              lots: parseFloat(p.lots),
            }))
            .filter((p) => !isNaN(p.price) && !isNaN(p.lots) && p.lots > 0)
        : null;

    const payload: TradeInput = {
      symbol: symbol.trim().toUpperCase(),
      direction,
      account_id: accountId || null,
      entry_price: parseFloat(entryPrice),
      exit_price: effectiveExit ? parseFloat(effectiveExit) : null,
      stop_loss: stopLoss ? parseFloat(stopLoss) : null,
      take_profit: takeProfit ? parseFloat(takeProfit) : null,
      quantity: parseFloat(quantity) || 1,
      pnl: effectivePnl ? parseFloat(effectivePnl) : null,
      r_multiple: rMultiple,
      mae: mae ? parseFloat(mae) : null,
      mfe: mfe ? parseFloat(mfe) : null,
      setup: setup || null,
      session: (session || null) as TradeInput["session"],
      market_condition: marketCondition || null,
      confidence: status !== "open" ? confidence : null,
      emotion_before: emotionBefore.length ? emotionBefore : null,
      emotion_after: emotionAfter.length ? emotionAfter : null,
      mistakes: mistakes.length ? mistakes : null,
      partials: partialsPayload && partialsPayload.length > 0 ? partialsPayload : null,
      confluences: confluences.length ? confluences : null,
      notes: notes || null,
      status,
      entry_time: new Date(entryTime).toISOString(),
      exit_time: exitTime ? new Date(exitTime).toISOString() : null,
    };

    const result = tradeId
      ? await updateTrade(tradeId, payload)
      : await createTrade(payload);

    if (result.error) {
      setError(result.error);
      toast.error("Couldn't save trade", { description: result.error });
      setSaving(false);
      return;
    }

    setSuccess(true);
    toast.success(`Trade ${tradeId ? "updated" : "logged"}`, {
      description: `${payload.symbol} ${payload.direction} ${payload.status === "open" ? "opened" : "recorded"}`,
    });
    setSaving(false);
    setTimeout(() => {
      onSaved?.();
    }, 600);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Direction toggle ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDirection("LONG")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all",
            direction === "LONG"
              ? "border-profit bg-profit/15 text-profit shadow-xs"
              : "border-border bg-surface-2 text-foreground-muted hover:border-border-strong",
          )}
        >
          <TrendingUp className="w-4 h-4" />
          LONG (BUY)
        </button>
        <button
          type="button"
          onClick={() => setDirection("SHORT")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all",
            direction === "SHORT"
              ? "border-loss bg-loss/15 text-loss shadow-xs"
              : "border-border bg-surface-2 text-foreground-muted hover:border-border-strong",
          )}
        >
          <TrendingDown className="w-4 h-4" />
          SHORT (SELL)
        </button>
      </div>

      {/* ── Primary Executive Fields (10-Second Quick Log) ── */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4 shadow-xs">
        {/* Account Selector + Symbol (Prominent Top Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="account" className="flex items-center justify-between text-xs font-bold font-mono uppercase tracking-wider text-foreground">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-brand" />
                Select Account *
              </span>
              {accounts.length === 0 && (
                <Link href="/dashboard/accounts" className="text-[10px] text-brand hover:underline font-normal">
                  + Add Account
                </Link>
              )}
            </Label>
            <Select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-surface-2 text-xs font-medium h-9 border-border-strong"
            >
              <option value="">No specific account (Personal)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.account_type.toUpperCase()} · {acc.broker || "Standard"})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="symbol" className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
              Symbol / Asset *
            </Label>
            <Input
              id="symbol"
              placeholder="e.g. XAUUSD, EURUSD, NQ"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              required
              className="h-9 font-mono font-bold text-xs uppercase"
            />
          </div>
        </div>

        {/* Execution Prices */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="entry" className="text-xs font-semibold text-foreground-muted">
              Entry Price *
            </Label>
            <Input
              id="entry"
              type="number"
              step="0.00001"
              placeholder="2050.00"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              required
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stop" className="text-xs font-semibold text-foreground-muted">
              Stop Loss
            </Label>
            <Input
              id="stop"
              type="number"
              step="0.00001"
              placeholder="2046.00"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp" className="text-xs font-semibold text-foreground-muted">
              Take Profit
            </Label>
            <Input
              id="tp"
              type="number"
              step="0.00001"
              placeholder="2060.00"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
        </div>

        {/* Status, Exit, Lots, P&L */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-foreground-muted">
              Status
            </Label>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TradeInput["status"])}
              className="h-9 text-xs"
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
              <option value="breakeven">Breakeven</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exit" className="text-xs font-semibold text-foreground-muted">
              Exit Price {partialMode && "(auto)"}
            </Label>
            <Input
              id="exit"
              type="number"
              step="0.00001"
              placeholder="2055.00"
              value={effectiveExit}
              onChange={(e) => setExitPrice(e.target.value)}
              readOnly={partialMode && !!partialComputation}
              disabled={status === "open"}
              className={cn("h-9 font-mono text-xs", status === "open" && "opacity-50")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity" className="text-xs font-semibold text-foreground-muted">
              Lot Size
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="1.00"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pnl" className="text-xs font-semibold text-foreground-muted">
                P&amp;L ($)
              </Label>
              {rMultiple != null && (
                <span className={cn("text-[10px] font-mono font-bold", rMultiple >= 0 ? "text-profit" : "text-loss")}>
                  {rMultiple > 0 ? "+" : ""}{rMultiple.toFixed(2)}R
                </span>
              )}
            </div>
            <Input
              id="pnl"
              type="number"
              step="0.01"
              placeholder="+250.00"
              value={effectivePnl}
              onChange={(e) => setPnl(e.target.value)}
              readOnly={partialMode && partialComputation?.combinedPnl != null}
              disabled={status === "open"}
              className={cn(
                "h-9 font-mono font-bold text-xs",
                parseFloat(effectivePnl) > 0 && "text-profit",
                parseFloat(effectivePnl) < 0 && "text-loss",
                status === "open" && "opacity-50"
              )}
            />
          </div>
        </div>

        {/* Setup & Session */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
          <div className="space-y-1.5">
            <Label htmlFor="setup" className="text-xs font-semibold text-foreground-muted">
              Setup / Model
            </Label>
            <Select
              id="setup"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">— Select Setup —</option>
              {setupsList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="session" className="text-xs font-semibold text-foreground-muted">
              Trading Session
            </Label>
            <Select
              id="session"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">— Select Session —</option>
              {SESSIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* ── Progressive Disclosure Accordion ── */}
      <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-mono font-bold text-foreground-muted hover:text-foreground hover:bg-surface-2/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>{showAdvanced ? "▼" : "▶"}</span>
            <span>Advanced Execution Details &amp; Mindset (Optional)</span>
          </span>
          <span className="text-[11px] text-foreground-subtle font-normal">
            {showAdvanced ? "Collapse" : "Expand"}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-4 pt-2 space-y-4 border-t border-border/60 animate-fade-in">
            {/* Timestamps & Market Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="entryTime" className="text-[11px] text-foreground-subtle">
                  Entry Time
                </Label>
                <Input
                  id="entryTime"
                  type="datetime-local"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exitTime" className="text-[11px] text-foreground-subtle">
                  Exit Time
                </Label>
                <Input
                  id="exitTime"
                  type="datetime-local"
                  value={exitTime}
                  onChange={(e) => setExitTime(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mc" className="text-[11px] text-foreground-subtle">
                  Market Condition
                </Label>
                <Select
                  id="mc"
                  value={marketCondition}
                  onChange={(e) => setMarketCondition(e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="">— none —</option>
                  <option value="Trending">Trending</option>
                  <option value="Ranging">Ranging</option>
                  <option value="Volatile">Volatile</option>
                  <option value="Choppy">Choppy</option>
                </Select>
              </div>
            </div>

            {/* Partial TP System Toggle */}
            <div className="rounded-lg border border-border/70 bg-surface p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer text-xs font-semibold">Multiple Partial Exits</Label>
                  <p className="text-[11px] text-foreground-subtle">
                    Log volume-weighted scale-out levels.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPartialMode(!partialMode)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    partialMode ? "bg-brand" : "bg-surface-3"
                  )}
                  role="switch"
                  aria-checked={partialMode}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                      partialMode && "translate-x-5"
                    )}
                  />
                </button>
              </div>

              {partialMode && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  {partials.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="Exit Price"
                        value={p.price}
                        onChange={(e) => updatePartial(idx, "price", e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Lots"
                        value={p.lots}
                        onChange={(e) => updatePartial(idx, "lots", e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removePartial(idx)}
                        className="p-1 text-foreground-subtle hover:text-loss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPartial}
                    className="text-xs text-brand font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Partial
                  </button>
                </div>
              )}
            </div>

            {/* Confluence Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confluence Checklist</Label>
              <div className="flex flex-wrap gap-1">
                {CONFLUENCE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleArray(confluences, setConfluences, tag)}
                  >
                    <Badge
                      variant={confluences.includes(tag) ? "brand" : "outline"}
                      className="cursor-pointer text-[10px]"
                    >
                      {tag}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Psychology Chips & Confidence */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Execution Quality (1-10)</Label>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Emotions State</Label>
                <div className="flex flex-wrap gap-1">
                  {EMOTIONS.slice(0, 8).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => toggleArray(emotionBefore, setEmotionBefore, em)}
                    >
                      <Badge
                        variant={emotionBefore.includes(em) ? "brand" : "outline"}
                        className="cursor-pointer text-[10px] capitalize"
                      >
                        {em}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Notes */}
            <div className="space-y-1 pt-1">
              <Label htmlFor="notes" className="text-xs font-semibold">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Brief technical or emotional execution note…"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Direct Link to Journal Review */}
            <div className="p-2.5 rounded-lg bg-surface border border-border/70 flex items-center justify-between text-xs">
              <span className="text-foreground-muted">
                Need full post-mortem analysis, rule checklists, and chart screenshots?
              </span>
              <Link
                href="/dashboard/journal-review"
                className="text-brand font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2"
                onClick={onCancel}
              >
                Journal Review <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Error / Success Alerts ── */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-xs text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-profit/30 bg-profit/10 px-3.5 py-2.5 text-xs text-profit flex items-center gap-2">
          <Check className="w-4 h-4" />
          Trade logged successfully.
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={saving}
          size="sm"
          className="font-semibold text-xs h-9 px-5 bg-foreground text-background hover:bg-foreground/90 shadow-xs"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Recording…
            </>
          ) : tradeId ? (
            "Update Trade"
          ) : (
            "Save Trade"
          )}
        </Button>
      </div>
    </form>
  );
}
