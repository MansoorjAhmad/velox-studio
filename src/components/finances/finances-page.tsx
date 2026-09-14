"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  getDebts,
  createDebt,
  deleteDebt,
  logDebtPayment,
} from "@/lib/finances/actions";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type Transaction,
  type Debt,
} from "@/lib/finances/types";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  CreditCard,
  Wallet,
  Loader2,
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn, formatCurrency, dateKey } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════
//  ROOT PAGE
// ════════════════════════════════════════════════════════════════

export function FinancesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("transactions");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [txRes, debtRes] = await Promise.all([
      getTransactions(),
      getDebts(),
    ]);
    if (txRes.error) setError(txRes.error);
    if (debtRes.error) setError(debtRes.error);
    setTransactions(txRes.data ?? []);
    setDebts(debtRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Monthly summary for current month.
  const summary = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthTx = transactions.filter((t) => t.date.startsWith(ym));
    const income = monthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = monthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return { income, expenses, net: income - expenses, count: monthTx.length };
  }, [transactions]);

  // Total outstanding debt (not paid off)
  const totalDebt = debts.filter(d => !d.is_paid_off).reduce((s, d) => s + d.balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">Finances</h1>
            <p className="text-sm text-foreground-muted">
              Income, expenses, and debt payoff.
            </p>
          </div>
        </div>
        {/* Dynamic CTA button */}
        {activeTab === "transactions" ? (
          <Button
            size="sm"
            onClick={() => {
              // Trigger via event since TransactionsTab handles its own state
              document.getElementById("add-transaction-btn")?.click();
            }}
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              document.getElementById("add-debt-btn")?.click();
            }}
          >
            <Plus className="w-4 h-4" />
            Add Debt / Loan
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Income (month)"
            value={formatCurrency(summary.income)}
            tone="profit"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <KpiCard
            label="Expenses (month)"
            value={formatCurrency(summary.expenses)}
            tone="loss"
            icon={<TrendingDown className="w-4 h-4" />}
          />
          <KpiCard
            label="Net (month)"
            value={formatCurrency(summary.net, { sign: true })}
            tone={summary.net >= 0 ? "profit" : "loss"}
            icon={<Wallet className="w-4 h-4" />}
          />
          <KpiCard
            label="Total Debt"
            value={formatCurrency(totalDebt)}
            tone={totalDebt > 0 ? "loss" : "neutral"}
            icon={<CreditCard className="w-4 h-4" />}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="debts">
            Debts {debts.filter(d => !d.is_paid_off).length > 0 && `(${debts.filter(d => !d.is_paid_off).length})`}
          </TabsTrigger>
        </TabsList>

        {/* ─── Transactions tab ─── */}
        <TabsContent value="transactions">
          <TransactionsTab
            transactions={transactions}
            loading={loading}
            onChanged={load}
          />
        </TabsContent>

        {/* ─── Debts tab ─── */}
        <TabsContent value="debts">
          <DebtsTab debts={debts} loading={loading} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  TRANSACTIONS TAB
// ════════════════════════════════════════════════════════════════

/** Build last 6 months of cashflow data from transactions */
function buildCashflowMonths(transactions: Transaction[]) {
  const now = new Date();
  const months: { label: string; key: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      key,
      income: 0,
      expense: 0,
    });
  }
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    const m = months.find(m => m.key === key);
    if (!m) continue;
    if (t.type === "income") m.income += t.amount;
    else m.expense += t.amount;
  }
  return months;
}

function CashflowChart({ transactions }: { transactions: Transaction[] }) {
  const months = useMemo(() => buildCashflowMonths(transactions), [transactions]);
  const maxVal = Math.max(...months.flatMap(m => [m.income, m.expense]), 1);

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/50 py-6 text-center">
        <p className="text-xs text-foreground-muted">Log transactions to see monthly cashflow.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">
        Cashflow — Last 6 Months
      </p>
      <div className="flex items-end justify-between gap-2 h-28">
        {months.map((m) => {
          const incH = Math.round((m.income / maxVal) * 100);
          const expH = Math.round((m.expense / maxVal) * 100);
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 w-full h-20">
                <div
                  className="flex-1 bg-profit/70 rounded-t-sm transition-all"
                  style={{ height: `${incH}%` }}
                  title={`Income: ${formatCurrency(m.income)}`}
                />
                <div
                  className="flex-1 bg-loss/70 rounded-t-sm transition-all"
                  style={{ height: `${expH}%` }}
                  title={`Expenses: ${formatCurrency(m.expense)}`}
                />
              </div>
              <span className="text-[10px] text-foreground-subtle">{m.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-profit/70" />
          <span className="text-[10px] text-foreground-muted">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-loss/70" />
          <span className="text-[10px] text-foreground-muted">Expenses</span>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({
  transactions,
  loading,
  onChanged,
}: {
  transactions: Transaction[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dateKey());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setErr("Enter a valid amount.");
      setSaving(false);
      return;
    }
    const res = await createTransaction({
      type,
      amount: amt,
      category: category || cats[0],
      description: description || null,
      date,
      recurring: "none",
    });
    setSaving(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setAmount("");
    setDescription("");
    setShowForm(false);
    onChanged();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden trigger button for parent CTA */}
      <button id="add-transaction-btn" className="hidden" onClick={() => setShowForm(true)} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">
          {transactions.length} transactions logged
        </p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      {/* Cashflow Chart */}
      <CashflowChart transactions={transactions} />

      {transactions.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No transactions yet"
          desc="Log your first income or expense to see your cashflow."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs uppercase tracking-wider text-foreground-subtle">
                <th className="text-left font-medium px-4 py-2.5">Date</th>
                <th className="text-left font-medium px-4 py-2.5">Category</th>
                <th className="text-left font-medium px-4 py-2.5">Description</th>
                <th className="text-right font-medium px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-border hover:bg-surface-2/50 group"
                >
                  <td className="px-4 py-3 text-foreground-subtle">
                    {new Date(t.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.type === "income" ? "profit" : "default"}>
                      {t.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {t.description ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right tabular font-semibold",
                      t.type === "income" ? "text-profit" : "text-loss",
                    )}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => {
                        await deleteTransaction(t.id);
                        onChanged();
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Transaction"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setType("income"); setCategory(""); }}
              className={cn(
                "rounded-md border py-2 text-sm font-medium transition-all",
                type === "income"
                  ? "border-profit bg-profit/10 text-profit"
                  : "border-border text-foreground-muted hover:border-border-strong",
              )}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => { setType("expense"); setCategory(""); }}
              className={cn(
                "rounded-md border py-2 text-sm font-medium transition-all",
                type === "expense"
                  ? "border-loss bg-loss/10 text-loss"
                  : "border-border text-foreground-muted hover:border-border-strong",
              )}
            >
              Expense
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {cats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {err && <p className="text-sm text-danger">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DEBTS TAB — Full rebuild per spec
// ════════════════════════════════════════════════════════════════

type DebtStatus = "active" | "due_soon" | "overdue" | "paid";

function getDebtStatus(debt: Debt): DebtStatus {
  if (debt.is_paid_off || debt.balance <= 0) return "paid";
  // Compute due_soon / overdue from due_day if available.
  if (debt.due_day != null) {
    const now = new Date();
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const due = Math.min(debt.due_day, daysInMonth);
    if (today > due) return "overdue";
    if (today >= due - 5) return "due_soon";
  }
  return "active";
}

const STATUS_CONFIG: Record<DebtStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-brand/15 text-brand" },
  due_soon: { label: "Due Soon", className: "bg-warning/15 text-warning" },
  overdue: { label: "Overdue", className: "bg-loss/15 text-loss" },
  paid: { label: "Fully Paid", className: "bg-profit/15 text-profit" },
};

function DebtsTab({
  debts,
  loading,
  onChanged,
}: {
  debts: Debt[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [payFor, setPayFor] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(dateKey());
  const [paySaving, setPaySaving] = useState(false);

  const handlePay = async () => {
    if (!payFor) return;
    setPaySaving(true);
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaySaving(false);
      return;
    }
    await logDebtPayment(payFor.id, amt);
    setPaySaving(false);
    setPayFor(null);
    setPayAmount("");
    setPayDate(dateKey());
    onChanged();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const activeDebts = debts.filter(d => !d.is_paid_off);
  const paidDebts = debts.filter(d => d.is_paid_off);

  return (
    <div className="space-y-4">
      {/* Hidden trigger for parent CTA */}
      <button id="add-debt-btn" className="hidden" onClick={() => setShowForm(true)} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">
          {activeDebts.length} active · {formatCurrency(
            activeDebts.reduce((s, d) => s + d.balance, 0),
          )}{" "}
          total
        </p>
        <a href="/dashboard/debts">
          <Button size="sm" variant="outline">
            <ArrowUpRight className="w-4 h-4" />
            Debt Analytics
          </Button>
        </a>
      </div>

      {debts.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8" />}
          title="No active debts or loans logged"
          desc="Add your loans, credit cards, or money owed to track payoff progress."
        />
      ) : (
        <div className="space-y-6">
          {/* Active debts */}
          {activeDebts.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {activeDebts.map((d) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  onPay={() => {
                    setPayFor(d);
                    setPayAmount(d.min_payment?.toString() ?? "");
                    setPayDate(dateKey());
                  }}
                  onDelete={async () => {
                    await deleteDebt(d.id);
                    onChanged();
                  }}
                />
              ))}
            </div>
          )}

          {/* Paid-off debts */}
          {paidDebts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2">
                Paid Off 🎉
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {paidDebts.map((d) => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    onPay={undefined}
                    onDelete={async () => {
                      await deleteDebt(d.id);
                      onChanged();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Debt / Loan Modal */}
      <AddDebtModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          onChanged();
        }}
      />

      {/* Log Payment Modal */}
      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title={`Log Payment — ${payFor?.name ?? ""}`}
      >
        <div className="space-y-4">
          <div className="rounded-md bg-surface-2 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Current balance</span>
              <span className="tabular font-semibold text-loss">
                {formatCurrency(payFor?.balance ?? 0)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="100.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={paySaving}>
              {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DebtCard({
  debt,
  onPay,
  onDelete,
}: {
  debt: Debt;
  onPay?: () => void;
  onDelete: () => void;
}) {
  const original = debt.original_balance ?? debt.balance;
  const paid = original - debt.balance;
  const pct = original > 0 ? Math.max(0, Math.min(100, (paid / original) * 100)) : 0;
  const status = getDebtStatus(debt);
  const statusCfg = STATUS_CONFIG[status];

  return (
    <Card className={cn(debt.is_paid_off && "opacity-70")}>
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{debt.name}</p>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-sm leading-none", statusCfg.className)}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-foreground-subtle mt-0.5">
              {debt.creditor && `${debt.creditor}`}
              {debt.interest_rate != null && ` · ${debt.interest_rate}% APR`}
              {debt.min_payment != null && ` · Min ${formatCurrency(debt.min_payment)}/mo`}
            </p>
          </div>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss shrink-0 ml-2"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Balance */}
        <div className="flex items-end justify-between">
          <div>
            <p className={cn(
              "text-2xl font-bold tabular",
              debt.is_paid_off ? "text-profit" : "text-loss"
            )}>
              {formatCurrency(debt.balance)}
            </p>
            <p className="text-xs text-foreground-subtle">
              of {formatCurrency(original)} original
            </p>
          </div>
          {paid > 0 && (
            <div className="text-right">
              <p className="text-xs text-foreground-subtle">Cleared</p>
              <p className="text-sm tabular font-medium text-profit">
                {formatCurrency(paid)}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-profit transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-foreground-subtle">{pct.toFixed(0)}% paid off</span>
          </div>
        </div>

        {/* Action */}
        {onPay && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onPay}
          >
            Log Payment
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AddDebtModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [original, setOriginal] = useState("");
  const [rate, setRate] = useState("");
  const [minPay, setMinPay] = useState("");
  const [creditor, setCreditor] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required.");
      setSaving(false);
      return;
    }
    const bal = parseFloat(balance);
    if (isNaN(bal) || bal <= 0) {
      setErr("Enter a valid balance.");
      setSaving(false);
      return;
    }
    const res = await createDebt({
      name: name.trim(),
      creditor: creditor || null,
      balance: bal,
      original_balance: original ? parseFloat(original) : bal,
      interest_rate: rate ? parseFloat(rate) : null,
      min_payment: minPay ? parseFloat(minPay) : null,
      due_day: null,
      strategy: "avalanche",
    });
    setSaving(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setName(""); setBalance(""); setOriginal(""); setRate(""); setMinPay(""); setCreditor("");
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Debt / Loan">
      <form onSubmit={handleAdd} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            placeholder="e.g. Car Loan, Friend (Ahmed), Credit Card"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Current Balance *</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="3500.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Original Balance</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="5000.00"
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Interest Rate (%)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="19.99"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Min Payment</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="75.00"
              value={minPay}
              onChange={(e) => setMinPay(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Creditor / Entity (optional)</Label>
          <Input
            placeholder="Bank name, person's name, etc."
            value={creditor}
            onChange={(e) => setCreditor(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Debt"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHARED
// ════════════════════════════════════════════════════════════════

function KpiCard({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-foreground-subtle">
          {label}
        </CardTitle>
        <span className="text-foreground-subtle">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold tabular", toneClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/50 py-12 text-center">
      <div className="text-foreground-subtle mx-auto mb-3 w-fit">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-foreground-muted mt-1">{desc}</p>
    </div>
  );
}
