import type { Trade } from "./types";

/** A single closed trade with a known P&L. */
type ClosedTrade = Trade & { pnl: number };

const isClosed = (t: Trade): t is ClosedTrade =>
  t.status === "closed" && typeof t.pnl === "number";

// ────────────────────────────────────────────────────────────────
//  CORE METRICS
// ────────────────────────────────────────────────────────────────

export interface Metrics {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;          // 0..1
  lossRate: number;         // 0..1
  grossProfit: number;
  grossLoss: number;        // positive number
  netPnl: number;
  profitFactor: number;     // grossProfit / grossLoss
  expectancy: number;       // avg $ per trade
  avgWin: number;
  avgLoss: number;          // negative number
  avgRMultiple: number;
  bestTrade: number;
  worstTrade: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgHoldMinutes: number;
}

/**
 * Normalizes profit factor (an open-ended ratio) to a 0-100 scale.
 * 0 -> 0, 1.0 (breakeven) -> 50, 2.0 (solid edge) -> 80, 3.0+ -> 100 (capped).
 */
function normalizeProfitFactor(pf: number): number {
  if (!isFinite(pf)) return 100;
  if (pf <= 0) return 0;
  if (pf <= 1) return pf * 50;
  if (pf <= 2) return 50 + (pf - 1) * 30;
  if (pf <= 3) return 80 + (pf - 2) * 20;
  return 100;
}

export interface TradingScore {
  score: number;
  grade: string;
  winRateComponent: number;
  profitFactorComponent: number;
}

export function calculateTradingScore(metrics: Metrics): TradingScore {
  if (metrics.closedTrades === 0) {
    return {
      score: 0,
      grade: "—",
      winRateComponent: 0,
      profitFactorComponent: 0,
    };
  }

  const winRateComponent = metrics.winRate * 100;
  const profitFactorComponent = normalizeProfitFactor(metrics.profitFactor);
  const rawScore = (winRateComponent + profitFactorComponent) / 2;

  // Small-sample dampening: With fewer than 10 trades, single wins/losses skew the score.
  // Regress toward 50 (neutral) based on sample size confidence.
  const confidence = Math.min(1, metrics.closedTrades / 10);
  const score = Math.round(50 * (1 - confidence) + rawScore * confidence);

  const grade =
    metrics.closedTrades < 3 ? "Evaluating" :
    score >= 90 ? "A+ Apex" :
    score >= 75 ? "A Solid" :
    score >= 60 ? "B+ Building" :
    score >= 40 ? "C Needs Focus" : "D Critical";

  return { score, grade, winRateComponent, profitFactorComponent };
}

export function calculateMetrics(trades: Trade[]): Metrics {
  const closed = trades.filter(isClosed).sort(
    (a, b) =>
      new Date(a.exit_time ?? a.entry_time).getTime() -
      new Date(b.exit_time ?? b.entry_time).getTime(),
  );

  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const breakevens = closed.filter((t) => t.pnl === 0);

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const netPnl = grossProfit - grossLoss;

  // Streaks — iterate in chronological order.
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of closed) {
    if (t.pnl > 0) {
      curWin++;
      curLoss = 0;
      maxWinStreak = Math.max(maxWinStreak, curWin);
    } else if (t.pnl < 0) {
      curLoss++;
      curWin = 0;
      maxLossStreak = Math.max(maxLossStreak, curLoss);
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  // Average hold time (minutes).
  const holdTimes = closed
    .filter((t) => t.exit_time)
    .map((t) =>
      (new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime()) /
      60000,
    );
  const avgHoldMinutes =
    holdTimes.length > 0
      ? holdTimes.reduce((s, x) => s + x, 0) / holdTimes.length
      : 0;

  // Average R-multiple.
  const rValues = closed
    .map((t) => t.r_multiple)
    .filter((r): r is number => r != null && isFinite(r));
  const avgRMultiple =
    rValues.length > 0
      ? rValues.reduce((s, r) => s + r, 0) / rValues.length
      : 0;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === "open").length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate: closed.length > 0 ? wins.length / closed.length : 0,
    lossRate: closed.length > 0 ? losses.length / closed.length : 0,
    grossProfit,
    grossLoss,
    netPnl,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy: closed.length > 0 ? netPnl / closed.length : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? -grossLoss / losses.length : 0,
    avgRMultiple,
    bestTrade: closed.length > 0 ? Math.max(...closed.map((t) => t.pnl)) : 0,
    worstTrade: closed.length > 0 ? Math.min(...closed.map((t) => t.pnl)) : 0,
    maxWinStreak,
    maxLossStreak,
    avgHoldMinutes,
  };
}

// ────────────────────────────────────────────────────────────────
//  EQUITY CURVE — cumulative P&L over time, for charts.
// ────────────────────────────────────────────────────────────────

export interface EquityPoint {
  index: number;
  date: string;
  pnl: number;
  equity: number; // cumulative
}

export function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  const closed = trades
    .filter(isClosed)
    .sort(
      (a, b) =>
        new Date(a.exit_time ?? a.entry_time).getTime() -
        new Date(b.exit_time ?? b.entry_time).getTime(),
    );

  let cumulative = 0;
  return closed.map((t, i) => {
    cumulative += t.pnl;
    return {
      index: i + 1,
      date: (t.exit_time ?? t.entry_time).slice(0, 10),
      pnl: t.pnl,
      equity: cumulative,
    };
  });
}

// ────────────────────────────────────────────────────────────────
//  DRAWDOWN — peak-to-trough decline of the equity curve.
// ────────────────────────────────────────────────────────────────

export interface DrawdownResult {
  maxDrawdown: number;     // absolute $ value
  maxDrawdownPct: number;  // 0..1
}

// Worked example (verified):
//   equity curve: 100, 120, 90, 110, 70
//   - peak tracks running max: 100, 120, 120, 120, 120
//   - dd (peak - equity):       0,   0,  30,  10,  50
//   - maxDd = 50, maxDdPct = 50/120 = 0.4167  ✅ correct
//
// The % is always computed relative to peak equity (not balance), and
// guarded against peak ≤ 0 so early-account drawdowns don't divide by 0.
export function calculateDrawdown(
  trades: Trade[],
  startingBalance = 0,
): DrawdownResult {
  const curve = buildEquityCurve(trades);
  if (curve.length === 0) return { maxDrawdown: 0, maxDrawdownPct: 0 };

  const useBalance = startingBalance > 0;
  const getEquity = (cumPnl: number) => (useBalance ? startingBalance + cumPnl : cumPnl);

  let peak = useBalance ? startingBalance : Math.max(0, curve[0].equity);
  let maxDd = 0;
  let maxDdPct = 0;

  for (const point of curve) {
    const eq = getEquity(point.equity);
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? dd / peak : 0;
    }
  }

  return { maxDrawdown: maxDd, maxDrawdownPct: maxDdPct };
}

// ────────────────────────────────────────────────────────────────
//  BREAKDOWNS — group trades by a key and compute metrics per group.
// ────────────────────────────────────────────────────────────────

export interface BreakdownRow {
  key: string;
  trades: number;
  winRate: number;
  netPnl: number;
  avgR: number;
}

export function breakdownBy(
  trades: Trade[],
  keyFn: (t: Trade) => string | null,
): BreakdownRow[] {
  const groups = new Map<string, Trade[]>();

  for (const t of trades) {
    if (!isClosed(t)) continue;
    const key = keyFn(t);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const m = calculateMetrics(group);
      return {
        key,
        trades: m.closedTrades,
        winRate: m.winRate,
        netPnl: m.netPnl,
        avgR: m.avgRMultiple,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);
}

export const breakdownBySetup = (trades: Trade[]) =>
  breakdownBy(trades, (t) => t.setup);

export const breakdownBySession = (trades: Trade[]) =>
  breakdownBy(trades, (t) => t.session);

export const breakdownBySymbol = (trades: Trade[]) =>
  breakdownBy(trades, (t) => t.symbol);

export const breakdownByDirection = (trades: Trade[]) =>
  breakdownBy(trades, (t) => t.direction);

// ────────────────────────────────────────────────────────────────
//  CALENDAR — daily P&L for heatmap-style views.
// ────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: string;       // YYYY-MM-DD
  pnl: number;
  trades: number;
  wins: number;
}

export function buildCalendar(trades: Trade[]): Map<string, CalendarDay> {
  const days = new Map<string, CalendarDay>();

  for (const t of trades) {
    if (!isClosed(t)) continue;
    const date = (t.exit_time ?? t.entry_time).slice(0, 10);
    const existing = days.get(date) ?? {
      date,
      pnl: 0,
      trades: 0,
      wins: 0,
    };
    existing.pnl += t.pnl;
    existing.trades += 1;
    if (t.pnl > 0) existing.wins += 1;
    days.set(date, existing);
  }

  return days;
}

// ────────────────────────────────────────────────────────────────
//  STREAK (current) — today's running win/loss streak.
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
//  DRAWDOWN CURVE — underwater equity for analytics charts.
// ────────────────────────────────────────────────────────────────

export interface DrawdownPoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export function buildDrawdownCurve(trades: Trade[], startingBalance = 0): DrawdownPoint[] {
  const curve = buildEquityCurve(trades);
  if (curve.length === 0) return [];

  const useBalance = startingBalance > 0;
  const getEquity = (cumPnl: number) => (useBalance ? startingBalance + cumPnl : cumPnl);

  let peak = useBalance ? startingBalance : Math.max(0, curve[0].equity);
  return curve.map((p) => {
    const eq = getEquity(p.equity);
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    return {
      date: p.date,
      equity: eq,
      drawdown: dd === 0 ? 0 : -dd,
      drawdownPct: peak > 0 && dd > 0 ? -(dd / peak) * 100 : 0,
    };
  });
}

// ────────────────────────────────────────────────────────────────
//  R-MULTIPLE DISTRIBUTION
// ────────────────────────────────────────────────────────────────

export interface RBucket {
  label: string;
  count: number;
}

export function buildRMultipleBuckets(trades: Trade[]): RBucket[] {
  const buckets = [
    { label: "< -2R", min: -Infinity, max: -2 },
    { label: "-2R to -1R", min: -2, max: -1 },
    { label: "-1R to 0R", min: -1, max: 0 },
    { label: "0R to 1R", min: 0, max: 1 },
    { label: "1R to 2R", min: 1, max: 2 },
    { label: "2R to 3R", min: 2, max: 3 },
    { label: "3R+", min: 3, max: Infinity },
  ];

  const closed = trades.filter(isClosed).filter((t) => t.r_multiple != null);
  return buckets.map((b) => ({
    label: b.label,
    count: closed.filter((t) => t.r_multiple! > b.min && t.r_multiple! <= b.max).length,
  }));
}

// ────────────────────────────────────────────────────────────────
//  EMOTION CORRELATION
// ────────────────────────────────────────────────────────────────

export interface EmotionStat {
  emotion: string;
  trades: number;
  winRate: number;
  netPnl: number;
}

export function buildEmotionStats(trades: Trade[]): EmotionStat[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!isClosed(t) || !t.emotion_before?.length) continue;
    for (const e of t.emotion_before) {
      if (!map.has(e)) map.set(e, []);
      map.get(e)!.push(t);
    }
  }
  return Array.from(map.entries())
    .map(([emotion, group]) => {
      const closed = group.filter(isClosed);
      const wins = closed.filter((t) => t.pnl > 0).length;
      return {
        emotion,
        trades: closed.length,
        winRate: closed.length > 0 ? (wins / closed.length) * 100 : 0,
        netPnl: closed.reduce((s, t) => s + t.pnl, 0),
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);
}

// ────────────────────────────────────────────────────────────────
//  MONTHLY P&L BARS
// ────────────────────────────────────────────────────────────────

export interface MonthlyPnl {
  month: string;
  label: string;
  pnl: number;
  trades: number;
}

export function buildMonthlyPnl(trades: Trade[], months = 6): MonthlyPnl[] {
  const result: MonthlyPnl[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const monthTrades = trades.filter(
      (t): t is ClosedTrade =>
        isClosed(t) && (t.exit_time ?? t.entry_time).startsWith(key),
    );
    result.push({
      month: key,
      label,
      pnl: monthTrades.reduce((s, t) => s + t.pnl, 0),
      trades: monthTrades.length,
    });
  }
  return result;
}

export function currentStreak(trades: Trade[]): {
  type: "win" | "loss" | "none";
  count: number;
} {
  const closed = trades
    .filter(isClosed)
    .sort(
      (a, b) =>
        new Date(b.exit_time ?? b.entry_time).getTime() -
        new Date(a.exit_time ?? a.entry_time).getTime(),
    );

  if (closed.length === 0) return { type: "none", count: 0 };

  const last = closed[0];
  if (last.pnl === 0) return { type: "none", count: 0 };

  const type: "win" | "loss" = last.pnl > 0 ? "win" : "loss";
  let count = 0;
  for (const t of closed) {
    if (type === "win" && t.pnl > 0) count++;
    else if (type === "loss" && t.pnl < 0) count++;
    else break;
  }
  return { type, count };
}

// ────────────────────────────────────────────────────────────────
//  STREAK HISTORY — chronological win/loss sequence for charts.
//  Returns each streak run with its length and cumulative pnl.
// ────────────────────────────────────────────────────────────────

export interface StreakRun {
  type: "win" | "loss" | "breakeven";
  length: number;
  pnl: number;
  /** Index of the last trade in the run (1-based, chronological). */
  endIndex: number;
}

export function buildStreakHistory(trades: Trade[]): StreakRun[] {
  const closed = trades
    .filter(isClosed)
    .sort(
      (a, b) =>
        new Date(a.exit_time ?? a.entry_time).getTime() -
        new Date(b.exit_time ?? b.entry_time).getTime(),
    );

  if (closed.length === 0) return [];

  const runs: StreakRun[] = [];
  let currentType: "win" | "loss" | "breakeven" | null = null;
  let length = 0;
  let pnl = 0;
  let endIndex = 0;

  for (let i = 0; i < closed.length; i++) {
    const t = closed[i];
    endIndex = i + 1;
    const tType: "win" | "loss" | "breakeven" =
      t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "breakeven";

    if (currentType === null) {
      currentType = tType;
      length = 1;
      pnl = t.pnl;
    } else if (tType === currentType) {
      length++;
      pnl += t.pnl;
    } else {
      runs.push({ type: currentType, length, pnl, endIndex });
      currentType = tType;
      length = 1;
      pnl = t.pnl;
    }
  }

  // Push the final run.
  if (currentType !== null) {
    runs.push({ type: currentType, length, pnl, endIndex });
  }

  return runs;
}

// ────────────────────────────────────────────────────────────────
//  DRAWDOWN DETAILS — max drawdown %, duration, and recovery time.
//
//  Recovery time = how long (in trades + days) from the trough back
//  to a new equity high. If no recovery yet, recoveryTimeDays = null
//  and `recovered` = false.
// ────────────────────────────────────────────────────────────────

export interface DrawdownDetails {
  maxDrawdown: number;
  maxDrawdownPct: number;
  /** Number of trades from peak to trough. */
  maxDrawdownDurationTrades: number;
  /** Calendar days from the peak trade to the trough trade. */
  maxDrawdownDurationDays: number;
  /** Days from trough back to a new equity high (null if not yet recovered). */
  recoveryTimeDays: number | null;
  /** Whether equity has made a new high after the max drawdown. */
  recovered: boolean;
  /** Date of the trough (YYYY-MM-DD). */
  troughDate: string | null;
  /** Date of recovery (YYYY-MM-DD), or null. */
  recoveryDate: string | null;
}

export function calculateDrawdownDetails(
  trades: Trade[],
  startingBalance = 0,
): DrawdownDetails {
  const curve = buildEquityCurve(trades);
  if (curve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      maxDrawdownDurationTrades: 0,
      maxDrawdownDurationDays: 0,
      recoveryTimeDays: null,
      recovered: false,
      troughDate: null,
      recoveryDate: null,
    };
  }

  const useBalance = startingBalance > 0;
  const getEquity = (cumPnl: number) => (useBalance ? startingBalance + cumPnl : cumPnl);

  let peak = useBalance ? startingBalance : Math.max(0, curve[0].equity);
  let peakIndex = -1;
  let peakDate = curve[0].date;

  let maxDd = 0;
  let maxDdPct = 0;
  let troughIndex = -1;
  let troughDate: string | null = null;
  // The peak value that immediately preceded the worst drawdown — this is
  // the level equity must reclaim to count as "recovered". Captured at the
  // moment we record a new max drawdown (NOT the running peak, which keeps
  // climbing and would distort the recovery threshold).
  let peakAtMaxDrawdown = peak;
  let peakIndexAtMaxDrawdown = -1;

  for (let i = 0; i < curve.length; i++) {
    const eq = getEquity(curve[i].equity);
    if (eq > peak) {
      peak = eq;
      peakIndex = i;
      peakDate = curve[i].date;
    }
    const dd = peak - eq;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? dd / peak : 0;
      troughIndex = i;
      troughDate = curve[i].date;
      peakAtMaxDrawdown = peak;
      peakIndexAtMaxDrawdown = peakIndex;
    }
  }

  // Duration: peak trade index → trough trade index.
  const maxDrawdownDurationTrades =
    peakIndexAtMaxDrawdown >= 0 && troughIndex >= 0
      ? Math.max(0, troughIndex - peakIndexAtMaxDrawdown)
      : 0;

  const maxDrawdownDurationDays =
    peakIndexAtMaxDrawdown >= 0 && troughDate
      ? Math.max(
          0,
          Math.round(
            (new Date(troughDate).getTime() -
              new Date(curve[Math.max(0, peakIndexAtMaxDrawdown)].date).getTime()) /
              86400000,
          ),
        )
      : 0;

  // Recovery: from the trough forward, find the first index where equity
  // reaches or exceeds the peak that preceded the max drawdown.
  let recoveryIdx = -1;
  if (troughIndex >= 0) {
    for (let i = troughIndex + 1; i < curve.length; i++) {
      if (getEquity(curve[i].equity) >= peakAtMaxDrawdown) {
        recoveryIdx = i;
        break;
      }
    }
  }

  const recovered = recoveryIdx >= 0;
  const recoveryDate = recovered ? curve[recoveryIdx].date : null;
  const recoveryTimeDays =
    recovered && troughDate
      ? Math.max(
          0,
          Math.round(
            (new Date(recoveryDate!).getTime() -
              new Date(troughDate).getTime()) /
              86400000,
          ),
        )
      : null;

  return {
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    maxDrawdownDurationTrades,
    maxDrawdownDurationDays,
    recoveryTimeDays,
    recovered,
    troughDate,
    recoveryDate,
  };
}

