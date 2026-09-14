"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TradeForm } from "./trade-form";
import { TradeDetailDrawer } from "./trade-detail-drawer";
import { deleteTrade } from "@/lib/journal/actions";
import {
  Trash2,
  Pencil,
  ArrowUpDown,
  Search,
  TrendingUp,
  TrendingDown,
  Inbox,
  LayoutList,
  LayoutGrid,
  Eye,
  RotateCcw,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import type { Trade } from "@/lib/journal/types";
import { getTradingAccounts } from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getCustomStrategies } from "@/lib/journal/strategies";

type SortKey =
  | "entry_time"
  | "pnl"
  | "r_multiple"
  | "symbol"
  | "setup";

export function TradeList({
  trades,
  onChanged,
}: {
  trades: Trade[];
  onChanged?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [filterDir, setFilterDir] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<"" | "wins" | "losses">("");
  const [filterSetup, setFilterSetup] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry_time");
  const [sortAsc, setSortAsc] = useState(false);

  const [editing, setEditing] = useState<Trade | null>(null);
  const [viewing, setViewing] = useState<Trade | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);

  useEffect(() => {
    const loadAccs = async () => {
      const res = await getTradingAccounts();
      setAccounts(res.data ?? []);
    };
    loadAccs();
  }, []);

  const accountMap = useMemo(() => {
    const map = new Map<string, TradingAccount>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const setups = useMemo(() => {
    const logged = trades.map((t) => t.setup).filter(Boolean) as string[];
    const custom = getCustomStrategies();
    return Array.from(new Set([...logged, ...custom])).sort();
  }, [trades]);

  const hasActiveFilters = Boolean(
    search.trim() || filterDir || filterOutcome || filterSetup || filterSession
  );

  const resetFilters = () => {
    setSearch("");
    setFilterDir("");
    setFilterOutcome("");
    setFilterSetup("");
    setFilterSession("");
  };

  const filtered = useMemo(() => {
    let list = [...trades];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.setup?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      );
    }
    if (filterDir) list = list.filter((t) => t.direction === filterDir);
    if (filterOutcome === "wins") list = list.filter((t) => (t.pnl ?? 0) > 0);
    if (filterOutcome === "losses") list = list.filter((t) => (t.pnl ?? 0) < 0);
    if (filterSetup) list = list.filter((t) => t.setup === filterSetup);
    if (filterSession) list = list.filter((t) => t.session === filterSession);

    list.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sortKey) {
        case "entry_time":
          av = new Date(a.entry_time).getTime();
          bv = new Date(b.entry_time).getTime();
          break;
        case "pnl":
          av = a.pnl ?? -Infinity;
          bv = b.pnl ?? -Infinity;
          break;
        case "r_multiple":
          av = a.r_multiple ?? -Infinity;
          bv = b.r_multiple ?? -Infinity;
          break;
        case "symbol":
          av = a.symbol;
          bv = b.symbol;
          break;
        case "setup":
          av = a.setup ?? "";
          bv = b.setup ?? "";
          break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [trades, search, filterDir, filterOutcome, filterSetup, filterSession, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await deleteTrade(confirmDelete.id);
    setDeleting(false);
    setConfirmDelete(null);
    if (res?.error) {
      toast.error("Delete failed", { description: res.error });
    } else {
      toast.success("Trade deleted", {
        description: `${confirmDelete.symbol} ${confirmDelete.direction} removed from journal`,
      });
    }
    onChanged?.();
  };

  if (trades.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center animate-fade-in">
        <Inbox className="w-10 h-10 text-foreground-subtle mx-auto mb-3" />
        <h3 className="text-lg font-display font-bold text-foreground">Archive is currently empty</h3>
        <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto leading-relaxed">
          Begin logging your trade entries and exits to populate your journal, analytics, and Trader Index.
        </p>
      </div>
    );
  }

  const winCount = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const lossCount = trades.filter((t) => (t.pnl ?? 0) < 0).length;
  const longCount = trades.filter((t) => t.direction === "LONG").length;
  const shortCount = trades.filter((t) => t.direction === "SHORT").length;

  return (
    <div className="space-y-4">
      {/* Control Bar: Quick Filters + Search & View Mode */}
      <div className="bg-surface rounded-xl border border-border p-3.5 space-y-3 shadow-xs">
        {/* Row 1: Segmented Filters & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Quick Filter Pills */}
          <div className="flex items-center bg-surface-2 p-1 rounded-lg border border-border/80 text-xs font-mono">
            <button
              onClick={() => { setFilterOutcome(""); setFilterDir(""); }}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium",
                !filterOutcome && !filterDir
                  ? "bg-surface text-foreground font-bold shadow-xs"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setFilterOutcome((v) => (v === "wins" ? "" : "wins"))}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1",
                filterOutcome === "wins"
                  ? "bg-surface text-profit font-bold shadow-xs"
                  : "text-foreground-muted hover:text-profit"
              )}
            >
              <CheckCircle2 className="w-3 h-3 text-profit" />
              Wins ({winCount})
            </button>
            <button
              onClick={() => setFilterOutcome((v) => (v === "losses" ? "" : "losses"))}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1",
                filterOutcome === "losses"
                  ? "bg-surface text-loss font-bold shadow-xs"
                  : "text-foreground-muted hover:text-loss"
              )}
            >
              <XCircle className="w-3 h-3 text-loss" />
              Losses ({lossCount})
            </button>
            <button
              onClick={() => setFilterDir((v) => (v === "LONG" ? "" : "LONG"))}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium",
                filterDir === "LONG"
                  ? "bg-surface text-foreground font-bold shadow-xs"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              Longs ({longCount})
            </button>
            <button
              onClick={() => setFilterDir((v) => (v === "SHORT" ? "" : "SHORT"))}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium",
                filterDir === "SHORT"
                  ? "bg-surface text-foreground font-bold shadow-xs"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              Shorts ({shortCount})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 text-xs text-foreground-subtle hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            )}
            <div className="flex items-center bg-surface-2 p-1 rounded-lg border border-border/80 text-xs">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "table" ? "bg-surface text-foreground shadow-xs" : "text-foreground-subtle hover:text-foreground"
                )}
                title="Table View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "cards" ? "bg-surface text-foreground shadow-xs" : "text-foreground-subtle hover:text-foreground"
                )}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Search, Setup & Session Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
            <Input
              placeholder="Filter by symbol, setup, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-surface-2/60 border-border/80 focus:bg-surface"
            />
          </div>
          <Select
            value={filterSetup}
            onChange={(e) => setFilterSetup(e.target.value)}
            className="w-auto h-9 text-xs bg-surface-2/60"
          >
            <option value="">All setups</option>
            {setups.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            className="w-auto h-9 text-xs bg-surface-2/60"
          >
            <option value="">All sessions</option>
            <option value="Asia">Asia</option>
            <option value="London">London</option>
            <option value="New York">New York</option>
            <option value="Other">Other</option>
          </Select>
        </div>
      </div>

      {/* Filtered Empty State */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center space-y-3 animate-fade-in">
          <Inbox className="w-8 h-8 text-foreground-subtle mx-auto" />
          <div>
            <p className="text-sm font-semibold text-foreground">No executions match your criteria</p>
            <p className="text-xs text-foreground-muted mt-0.5">Try adjusting your filters or search keywords.</p>
          </div>
          <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs">
            Clear all filters
          </Button>
        </div>
      )}

      {/* Card / Grid View */}
      {viewMode === "cards" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filtered.map((t) => {
            const isProfit = (t.pnl ?? 0) > 0;
            const isLoss = (t.pnl ?? 0) < 0;
            return (
              <div
                key={t.id}
                onClick={() => setViewing(t)}
                className="group rounded-xl border border-border bg-surface p-4.5 space-y-3.5 hover:border-border-strong hover:shadow-md transition-all cursor-pointer relative"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base font-display text-foreground">{t.symbol}</span>
                    <Badge variant={t.direction === "LONG" ? "profit" : "loss"} className="text-[10px] font-mono">
                      {t.direction === "LONG" ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                      {t.direction}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono text-foreground-subtle">
                    {timeAgo(t.entry_time)}
                  </span>
                </div>

                {/* Primary Metric: P&L + R-Multiple */}
                <div className="flex items-baseline justify-between border-y border-border/60 py-2.5">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-foreground-subtle block">Realized P&L</span>
                    <span className={cn(
                      "font-mono text-2xl font-bold tracking-tight",
                      isProfit && "text-profit",
                      isLoss && "text-loss",
                      !isProfit && !isLoss && "text-foreground-muted"
                    )}>
                      {t.pnl != null ? formatCurrency(t.pnl, { sign: true }) : "—"}
                    </span>
                  </div>
                  {t.r_multiple != null && (
                    <Badge variant={t.r_multiple >= 0 ? "profit" : "loss"} className="font-mono text-xs font-bold">
                      {t.r_multiple > 0 ? "+" : ""}{t.r_multiple.toFixed(2)}R
                    </Badge>
                  )}
                </div>

                {/* Tags & Execution details */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-foreground-muted">
                  <div>
                    <span className="text-[9px] uppercase text-foreground-subtle block">Setup</span>
                    <span className="font-medium text-foreground truncate block">{t.setup || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-foreground-subtle block">Session</span>
                    <span className="font-medium text-foreground block">{t.session || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-foreground-subtle block">Entry Price</span>
                    <span className="font-medium">{t.entry_price?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-foreground-subtle block">Exit Price</span>
                    <span className="font-medium">{t.exit_price?.toFixed(2) ?? "—"}</span>
                  </div>
                </div>

                {/* Confluence Pills */}
                {t.confluences && t.confluences.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.confluences.slice(0, 3).map((c) => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-foreground-subtle border border-border/70 font-mono">
                        {c}
                      </span>
                    ))}
                    {t.confluences.length > 3 && (
                      <span className="text-[9px] px-1 py-0.5 text-foreground-subtle font-mono">
                        +{t.confluences.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    {t.screenshot_urls && t.screenshot_urls.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-brand font-mono">
                        <ImageIcon className="w-3 h-3" /> Chart
                      </span>
                    )}
                    {t.account_id && accountMap.has(t.account_id) && (
                      <span className="text-[10px] font-mono text-foreground-subtle">
                        {accountMap.get(t.account_id)!.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewing(t); }}
                      className="p-1 rounded hover:bg-surface-2 text-foreground-subtle hover:text-foreground"
                      title="Inspect"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(t); }}
                      className="p-1 rounded hover:bg-surface-2 text-foreground-subtle hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }}
                      className="p-1 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-surface-2/80 text-[11px] uppercase tracking-wider text-foreground-subtle border-b border-border">
                  <Th onClick={() => toggleSort("symbol")} active={sortKey === "symbol"}>
                    Asset
                  </Th>
                  <Th>Side</Th>
                  <Th onClick={() => toggleSort("setup")} active={sortKey === "setup"}>
                    Setup / Model
                  </Th>
                  <Th>Session</Th>
                  <th className="text-right font-semibold px-3 py-3 font-mono">Entry</th>
                  <th className="text-right font-semibold px-3 py-3 font-mono">Exit</th>
                  <Th onClick={() => toggleSort("r_multiple")} active={sortKey === "r_multiple"} align="right">
                    Return (R)
                  </Th>
                  <Th onClick={() => toggleSort("pnl")} active={sortKey === "pnl"} align="right">
                    Realized P&L
                  </Th>
                  <Th onClick={() => toggleSort("entry_time")} active={sortKey === "entry_time"}>
                    Date
                  </Th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setViewing(t)}
                    className="hover:bg-surface-2/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground font-mono">{t.symbol}</span>
                        {t.account_id && accountMap.has(t.account_id) && (
                          <span className="text-[9px] font-mono text-foreground-subtle">
                            {accountMap.get(t.account_id)!.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={t.direction === "LONG" ? "profit" : "loss"}
                        className="text-[10px] font-mono font-bold"
                      >
                        {t.direction === "LONG" ? (
                          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                        )}
                        {t.direction}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-foreground font-medium">
                      {t.setup ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-foreground-muted font-mono">
                      {t.session ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground-muted">
                      {t.entry_price?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground-muted">
                      {t.exit_price?.toFixed(2) ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-bold",
                        (t.r_multiple ?? 0) >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {t.r_multiple != null
                        ? `${t.r_multiple > 0 ? "+" : ""}${t.r_multiple.toFixed(2)}R`
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-bold text-sm",
                        (t.pnl ?? 0) > 0 && "text-profit",
                        (t.pnl ?? 0) < 0 && "text-loss",
                        t.pnl == null && "text-foreground-subtle",
                      )}
                    >
                      {t.pnl != null ? formatCurrency(t.pnl, { sign: true }) : "—"}
                    </td>
                    <td className="px-3 py-3 text-foreground-subtle text-xs font-mono">
                      {timeAgo(t.entry_time)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewing(t); }}
                          className="p-1.5 rounded hover:bg-surface-3 text-foreground-subtle hover:text-foreground"
                          title="Inspect Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(t); }}
                          className="p-1.5 rounded hover:bg-surface-3 text-foreground-subtle hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }}
                          className="p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade detail drawer */}
      <TradeDetailDrawer
        trade={viewing}
        onClose={() => setViewing(null)}
        onEdit={(t) => { setViewing(null); setEditing(t); }}
        onDelete={(t) => { setViewing(null); setConfirmDelete(t); }}
      />

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Trade"
        className="max-w-2xl"
      >
        {editing && (
          <TradeForm
            initial={editing}
            tradeId={editing.id}
            onSaved={() => {
              setEditing(null);
              onChanged?.();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete trade?"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            This will permanently delete your{" "}
            <span className="font-semibold text-foreground">
              {confirmDelete?.symbol}
            </span>{" "}
            trade from{" "}
            <span className="font-semibold text-foreground">
              {confirmDelete && timeAgo(confirmDelete.entry_time)}
            </span>
            . This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  align = "left",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-3 py-3 font-semibold", align === "right" && "text-right")}>
      {onClick ? (
        <button
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors font-mono",
            active && "text-foreground",
          )}
        >
          {children}
          <ArrowUpDown className="w-3 h-3 opacity-60" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}
