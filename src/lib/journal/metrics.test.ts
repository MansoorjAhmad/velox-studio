import { describe, it, expect } from "vitest";
import {
  calculateMetrics,
  calculateTradingScore,
  calculateDrawdown,
  calculateDrawdownDetails,
  buildDrawdownCurve,
  currentStreak,
} from "./metrics";
import { calculateDisciplineScore } from "../routine/score";
import type { Trade } from "./types";

function mockTrade(partial: Partial<Trade>): Trade {
  return {
    id: "test-" + Math.random().toString(36).slice(2),
    user_id: "user-1",
    account_id: "acc-1",
    symbol: "EURUSD",
    direction: "LONG",
    status: "closed",
    entry_time: "2026-03-01T10:00:00Z",
    exit_time: "2026-03-01T11:00:00Z",
    entry_price: 1.08,
    exit_price: 1.085,
    quantity: 1,
    pnl: 100,
    created_at: "2026-03-01T10:00:00Z",
    ...partial,
  } as Trade;
}

describe("Trading Metrics Engine Audit", () => {
  describe("calculateMetrics", () => {
    it("returns zeroed metrics for empty trades", () => {
      const m = calculateMetrics([]);
      expect(m.totalTrades).toBe(0);
      expect(m.closedTrades).toBe(0);
      expect(m.wins).toBe(0);
      expect(m.losses).toBe(0);
      expect(m.breakevens).toBe(0);
      expect(m.grossProfit).toBe(0);
      expect(m.grossLoss).toBe(0);
      expect(m.netPnl).toBe(0);
      expect(m.profitFactor).toBe(0);
      expect(m.winRate).toBe(0);
    });

    it("returns Infinity for profit factor when all closed trades are wins (grossLoss == 0)", () => {
      const trades = [
        mockTrade({ pnl: 250 }),
        mockTrade({ pnl: 150 }),
      ];
      const m = calculateMetrics(trades);
      expect(m.wins).toBe(2);
      expect(m.losses).toBe(0);
      expect(m.grossProfit).toBe(400);
      expect(m.grossLoss).toBe(0);
      expect(m.profitFactor).toBe(Infinity);
    });

    it("correctly calculates win rate, profit factor, and expectancy with mixed trades", () => {
      const trades = [
        mockTrade({ pnl: 200, r_multiple: 2 }),
        mockTrade({ pnl: -100, r_multiple: -1 }),
        mockTrade({ pnl: 0, r_multiple: 0 }),
      ];
      const m = calculateMetrics(trades);
      expect(m.closedTrades).toBe(3);
      expect(m.wins).toBe(1);
      expect(m.losses).toBe(1);
      expect(m.breakevens).toBe(1);
      expect(m.winRate).toBeCloseTo(1 / 3, 4);
      expect(m.grossProfit).toBe(200);
      expect(m.grossLoss).toBe(100);
      expect(m.profitFactor).toBe(2.0);
      expect(m.netPnl).toBe(100);
      expect(m.expectancy).toBeCloseTo(100 / 3, 4);
      expect(m.avgRMultiple).toBeCloseTo(1 / 3, 4);
    });

    it("filters out null or non-finite R-multiples safely", () => {
      const trades = [
        mockTrade({ pnl: 100, r_multiple: 1.5 }),
        mockTrade({ pnl: 50, r_multiple: null }),
        mockTrade({ pnl: -50, r_multiple: NaN }),
      ];
      const m = calculateMetrics(trades);
      expect(m.avgRMultiple).toBe(1.5);
    });
  });

  describe("calculateTradingScore (sample size dampening and empty state)", () => {
    it("returns neutral grade '—' and score 0 when 0 closed trades", () => {
      const m = calculateMetrics([]);
      const score = calculateTradingScore(m);
      expect(score.score).toBe(0);
      expect(score.grade).toBe("—");
    });

    it("dampens single-trade 100% win rate and marks grade as 'Evaluating'", () => {
      const trades = [mockTrade({ pnl: 500 })];
      const m = calculateMetrics(trades);
      const score = calculateTradingScore(m);
      expect(score.score).toBe(55);
      expect(score.grade).toBe("Evaluating");
    });

    it("scales score with sample size and reaches Apex with large consistent sample", () => {
      const trades = [];
      for (let i = 0; i < 16; i++) trades.push(mockTrade({ pnl: 200 }));
      for (let i = 0; i < 4; i++) trades.push(mockTrade({ pnl: -100 }));

      const m = calculateMetrics(trades);
      const score = calculateTradingScore(m);
      expect(m.closedTrades).toBe(20);
      expect(score.score).toBeGreaterThanOrEqual(90);
      expect(score.grade).toBe("A+ Apex");
    });
  });

  describe("calculateDrawdown and calculateDrawdownDetails", () => {
    it("does not report false drawdown on initial winning trade with starting balance", () => {
      const trades = [
        mockTrade({ pnl: 1000, entry_time: "2026-03-01T10:00:00Z", exit_time: "2026-03-01T11:00:00Z" }),
      ];
      const dd = calculateDrawdown(trades, 10000);
      expect(dd.maxDrawdown).toBe(0);
      expect(dd.maxDrawdownPct).toBe(0);

      const details = calculateDrawdownDetails(trades, 10000);
      expect(details.maxDrawdown).toBe(0);
      expect(details.maxDrawdownPct).toBe(0);
    });

    it("accurately tracks drawdown on account starting balance", () => {
      const trades = [
        mockTrade({ pnl: 1000, exit_time: "2026-03-01T10:00:00Z" }),
        mockTrade({ pnl: -1100, exit_time: "2026-03-02T10:00:00Z" }),
        mockTrade({ pnl: 2000, exit_time: "2026-03-03T10:00:00Z" }),
      ];
      const dd = calculateDrawdown(trades, 10000);
      expect(dd.maxDrawdown).toBe(1100);
      expect(dd.maxDrawdownPct).toBeCloseTo(1100 / 11000, 4);

      const details = calculateDrawdownDetails(trades, 10000);
      expect(details.maxDrawdown).toBe(1100);
      expect(details.maxDrawdownPct).toBeCloseTo(1100 / 11000, 4);
      expect(details.recovered).toBe(true);
      expect(details.maxDrawdownDurationTrades).toBe(1);
    });

    it("handles zero starting balance (cumulative P&L mode) without division by zero", () => {
      const trades = [mockTrade({ pnl: -500 })];
      const dd = calculateDrawdown(trades, 0);
      expect(dd.maxDrawdown).toBe(500);
      expect(dd.maxDrawdownPct).toBe(0);
    });

    it("buildDrawdownCurve accurately shifts points by starting balance", () => {
      const trades = [
        mockTrade({ pnl: 500, exit_time: "2026-03-01T10:00:00Z" }),
        mockTrade({ pnl: -200, exit_time: "2026-03-02T10:00:00Z" }),
      ];
      const curve = buildDrawdownCurve(trades, 10000);
      expect(curve).toHaveLength(2);
      expect(curve[0].equity).toBe(10500);
      expect(curve[0].drawdown).toBe(0);
      expect(curve[1].equity).toBe(10300);
      expect(curve[1].drawdown).toBe(-200);
      expect(curve[1].drawdownPct).toBeCloseTo(-(200 / 10500) * 100, 2);
    });
  });

  describe("currentStreak", () => {
    it("returns none for empty trades", () => {
      expect(currentStreak([])).toEqual({ type: "none", count: 0 });
    });

    it("does NOT treat breakeven ($0) as a winning streak", () => {
      const trades = [
        mockTrade({ pnl: 0, exit_time: "2026-03-02T10:00:00Z" }),
        mockTrade({ pnl: 100, exit_time: "2026-03-01T10:00:00Z" }),
      ];
      const streak = currentStreak(trades);
      expect(streak).toEqual({ type: "none", count: 0 });
    });

    it("accurately counts consecutive wins", () => {
      const trades = [
        mockTrade({ pnl: 200, exit_time: "2026-03-03T10:00:00Z" }),
        mockTrade({ pnl: 150, exit_time: "2026-03-02T10:00:00Z" }),
        mockTrade({ pnl: -50, exit_time: "2026-03-01T10:00:00Z" }),
      ];
      const streak = currentStreak(trades);
      expect(streak).toEqual({ type: "win", count: 2 });
    });
  });

  describe("calculateDisciplineScore", () => {
    it("returns neutral grade '—' and score 0 when 0% completion and 0 streak", () => {
      const d = calculateDisciplineScore(0, 0);
      expect(d.score).toBe(0);
      expect(d.grade).toBe("—");
    });

    it("computes proper composite score and Apex grade for top consistency", () => {
      const d = calculateDisciplineScore(100, 30);
      expect(d.score).toBe(100);
      expect(d.grade).toBe("A+ Apex");
    });
  });
});
