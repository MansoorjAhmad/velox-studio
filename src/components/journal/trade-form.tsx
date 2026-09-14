"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  COMMON_SETUPS,
  CONFLUENCE_TAGS,
  COMMON_EMOTIONS,
  COMMON_MISTAKES,
  SESSIONS,
  computeRMultiple,
  computeWeightedExit,
  type TradeInput,
} from "@/lib/journal/types";
import { createTrade, updateTrade } from "@/lib/journal/actions";
import { getTradingAccounts } from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getCustomStrategies, subscribeStrategiesListener } from "@/lib/journal/strategies";
import { useEffect } from "react";
import { TrendingUp, TrendingDown, Loader2, Check, Plus, X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAccountId } from "@/lib/accounts/active-account";

const EMOTIONS = [...COMMON_EMOTIONS];
const MISTAKES = [...COMMON_MISTAKES];

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
  const [emotionAfter, setEmotionAfter] = useState<string[]>(
    initial?.emotion_after ?? [],
  );
  const [mistakes, setMistakes] = useState<string[]>(initial?.mistakes ?? []);
  const [mae, setMae] = useState(initial?.mae?.toString() ?? "");
  const [mfe, setMfe] = useState(initial?.mfe?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [entryTime, setEntryTime] = useState(
    (initial?.entry_time ?? new Date().toISOString()).slice(0, 16),
  );
  const [exitTime, setExitTime] = useState(
    initial?.exit_time ? initial.exit_time.slice(0, 16) : "",
  );

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
      .filter(
        (p) => !isNaN(p.price) && !isNaN(p.lots) && p.lots > 0,
      );
    if (valid.length === 0) return null;

    const totalLots = valid.reduce((s, p) => s + p.lots, 0);
    const weightedSum = valid.reduce((s, p) => s + p.price * p.lots, 0);
    const weightedExit = weightedSum / totalLots;

    // Combined P&L: direction * Σ((price - entry) * lots)
    const entry = parseFloat(entryPrice);
    let combinedPnl = NaN;
    if (!isNaN(entry)) {
      const diff = valid.reduce(
        (s, p) => s + (p.price - entry) * p.lots,
        0,
      );
      combinedPnl =
        direction === "LONG" ? diff : -diff;
    }

    return {
      weightedExit: Math.round(weightedExit * 100000) / 100000,
      totalLots: Math.round(totalLots * 100000) / 100000,
      combinedPnl: isNaN(combinedPnl) ? null : Math.round(combinedPnl * 100) / 100,
    };
  }, [partialMode, partials, entryPrice, direction]);

  // When partial mode is on, the effective exit + pnl are auto-derived.
  const effectiveExit = partialMode && partialComputation
    ? partialComputation.weightedExit.toString()
    : exitPrice;
  const effectivePnl =
    partialMode && partialComputation?.combinedPnl != null
      ? partialComputation.combinedPnl.toString()
      : pnl;

  // Auto-compute R-multiple from effective exit.
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

    // Build partials payload (only valid rows) when in partial mode.
    const partialsPayload =
      partialMode && partialComputation
        ? partials
            .map((p) => ({
              price: parseFloat(p.price),
              lots: parseFloat(p.lots),
            }))
            .filter(
              (p) =>
                !isNaN(p.price) && !isNaN(p.lots) && p.lots > 0,
            )
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
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Direction toggle ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDirection("LONG")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border py-3 text-sm font-semibold transition-all",
            direction === "LONG"
              ? "border-profit bg-profit/10 text-profit"
              : "border-border bg-surface-2 text-foreground-muted hover:border-border-strong",
          )}
        >
          <TrendingUp className="w-4 h-4" />
          LONG
        </button>
        <button
          type="button"
          onClick={() => setDirection("SHORT")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border py-3 text-sm font-semibold transition-all",
            direction === "SHORT"
              ? "border-loss bg-loss/10 text-loss"
              : "border-border bg-surface-2 text-foreground-muted hover:border-border-strong",
          )}
        >
          <TrendingDown className="w-4 h-4" />
          SHORT
        </button>
      </div>

      {/* ── Core prices ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Selector */}
          {accounts.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg border border-border/80 bg-surface-2/40">
              <Label htmlFor="account" className="flex items-center gap-1.5 text-xs font-semibold">
                <Wallet className="w-3.5 h-3.5 text-brand" />
                Trading Account
              </Label>
              <Select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-surface text-xs font-medium"
              >
                <option value="">No specific account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.account_type.toUpperCase()} · {acc.broker || "No broker"})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="XAUUSD"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity / Size</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="1.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="entry">Entry Price *</Label>
              <Input
                id="entry"
                type="number"
                step="0.00001"
                placeholder="2050.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop">Stop Loss</Label>
              <Input
                id="stop"
                type="number"
                step="0.00001"
                placeholder="2048.00"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp">Take Profit</Label>
              <Input
                id="tp"
                type="number"
                step="0.00001"
                placeholder="2060.00"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </div>

            {/* Exit price — read-only when in partial mode */}
            <div className="space-y-1.5">
              <Label htmlFor="exit">
                Exit Price{partialMode ? " (auto)" : ""}
              </Label>
              <Input
                id="exit"
                type="number"
                step="0.00001"
                placeholder="2055.00"
                value={effectiveExit}
                onChange={(e) => setExitPrice(e.target.value)}
                readOnly={partialMode && !!partialComputation}
                className={cn(
                  partialMode &&
                    !!partialComputation &&
                    "bg-surface-2 text-foreground-muted cursor-not-allowed",
                )}
              />
            </div>
            {/* P&L — read-only when in partial mode */}
            <div className="space-y-1.5">
              <Label htmlFor="pnl">
                P&L ($){partialMode ? " (auto)" : ""}
              </Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                placeholder="285.50"
                value={effectivePnl}
                onChange={(e) => setPnl(e.target.value)}
                readOnly={partialMode && partialComputation?.combinedPnl != null}
                className={cn(
                  partialMode &&
                    partialComputation?.combinedPnl != null &&
                    "bg-surface-2 text-foreground-muted cursor-not-allowed",
                  parseFloat(effectivePnl) > 0 && "text-profit",
                  parseFloat(effectivePnl) < 0 && "text-loss",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>R Multiple (auto)</Label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-surface-2">
                {rMultiple != null ? (
                  <span
                    className={cn(
                      "text-sm tabular font-semibold",
                      rMultiple >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {rMultiple > 0 ? "+" : ""}
                    {rMultiple.toFixed(2)}R
                  </span>
                ) : (
                  <span className="text-sm text-foreground-subtle">
                    enter entry + stop + exit
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Partial TP system ── */}
          <div className="rounded-md border border-border/60 bg-surface-2/40 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer">Partial Exits</Label>
                <p className="text-xs text-foreground-subtle">
                  Log multiple take-profit levels (volume-weighted).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPartialMode((v) => !v)}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  partialMode ? "bg-brand" : "bg-surface-3",
                )}
                role="switch"
                aria-checked={partialMode}
                title={partialMode ? "Disable partials" : "Enable partials"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    partialMode && "translate-x-5",
                  )}
                />
              </button>
            </div>

            {partialMode && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center px-1">
                  <span className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                    Exit Price
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                    Lots
                  </span>
                  <span className="w-8" />
                </div>
                {partials.map((p, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                  >
                    <Input
                      type="number"
                      step="0.00001"
                      placeholder="2060.00"
                      value={p.price}
                      onChange={(e) => updatePartial(idx, "price", e.target.value)}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.50"
                      value={p.lots}
                      onChange={(e) => updatePartial(idx, "lots", e.target.value)}
                      className="h-9"
                    />
                    <button
                      type="button"
                      onClick={() => removePartial(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                      title="Remove partial"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPartial}
                  className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Partial
                </button>

                {partialComputation && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                    <div className="rounded bg-surface px-2.5 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                        Weighted Exit
                      </p>
                      <p className="text-sm tabular font-semibold">
                        {partialComputation.weightedExit}
                      </p>
                    </div>
                    <div className="rounded bg-surface px-2.5 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                        Total Lots
                      </p>
                      <p className="text-sm tabular font-semibold">
                        {partialComputation.totalLots}
                      </p>
                    </div>
                    {partialComputation.combinedPnl != null && (
                      <div className="rounded bg-surface px-2.5 py-1.5 col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                          Combined P&L
                        </p>
                        <p
                          className={cn(
                            "text-sm tabular font-bold",
                            partialComputation.combinedPnl > 0 && "text-profit",
                            partialComputation.combinedPnl < 0 && "text-loss",
                          )}
                        >
                          {partialComputation.combinedPnl > 0 ? "+" : ""}
                          {partialComputation.combinedPnl.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="entryTime">Entry Time</Label>
              <Input
                id="entryTime"
                type="datetime-local"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exitTime">Exit Time</Label>
              <Input
                id="exitTime"
                type="datetime-local"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as TradeInput["status"])
                }
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="breakeven">Breakeven</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup">Setup</Label>
              <Select
                id="setup"
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
              >
                <option value="">— none —</option>
                {setupsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session">Session</Label>
              <Select
                id="session"
                value={session}
                onChange={(e) => setSession(e.target.value)}
              >
                <option value="">— none —</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc">Market Condition</Label>
              <Select
                id="mc"
                value={marketCondition}
                onChange={(e) => setMarketCondition(e.target.value)}
              >
                <option value="">— none —</option>
                <option value="Trending">Trending</option>
                <option value="Ranging">Ranging</option>
                <option value="Volatile">Volatile</option>
                <option value="Choppy">Choppy</option>
              </Select>
            </div>
          </div>

          {/* ── Confluence tags ── */}
          <div className="space-y-2">
            <Label>Confluences</Label>
            <div className="flex flex-wrap gap-1.5">
              {CONFLUENCE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleArray(confluences, setConfluences, tag)}
                >
                  <Badge
                    variant={
                      confluences.includes(tag) ? "brand" : "outline"
                    }
                    className="cursor-pointer"
                  >
                    {tag}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mae">MAE (Max Adverse)</Label>
              <Input
                id="mae"
                type="number"
                step="0.00001"
                placeholder="0.50"
                value={mae}
                onChange={(e) => setMae(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfe">MFE (Max Favorable)</Label>
              <Input
                id="mfe"
                type="number"
                step="0.00001"
                placeholder="3.20"
                value={mfe}
                onChange={(e) => setMfe(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Psychology ── */}
      {status !== "open" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Psychology</CardTitle>
            <CardDescription>
              Tagging your state turns the journal into a real edge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Slider
              label="Confidence"
              min={1}
              max={10}
              step={1}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />

            <div className="space-y-2">
              <Label>Emotions Before</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => toggleArray(emotionBefore, setEmotionBefore, em)}
                  >
                    <Badge
                      variant={
                        emotionBefore.includes(em) ? "brand" : "outline"
                      }
                      className="cursor-pointer capitalize"
                    >
                      {em}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Emotions After</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => toggleArray(emotionAfter, setEmotionAfter, em)}
                  >
                    <Badge
                      variant={
                        emotionAfter.includes(em) ? "brand" : "outline"
                      }
                      className="cursor-pointer capitalize"
                    >
                      {em}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mistakes</Label>
              <div className="flex flex-wrap gap-1.5">
                {MISTAKES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleArray(mistakes, setMistakes, m)}
                  >
                    <Badge
                      variant={mistakes.includes(m) ? "loss" : "outline"}
                      className="cursor-pointer"
                    >
                      {m}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Notes ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Why did you take this trade? What was the plan? What did you learn?"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* ── Error / Success ── */}
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-profit/30 px-4 py-3 text-sm text-profit flex items-center gap-2">
          <Check className="w-4 h-4" />
          Trade {tradeId ? "updated" : "logged"} successfully.
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : tradeId ? (
            "Update Trade"
          ) : (
            "Log Trade"
          )}
        </Button>
      </div>
    </form>
  );
}
