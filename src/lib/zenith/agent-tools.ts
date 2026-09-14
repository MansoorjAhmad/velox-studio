import type { SupabaseClient } from "@supabase/supabase-js";
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import {
  calculateMetrics,
  calculateDrawdown,
  currentStreak,
  breakdownBySetup,
  breakdownBySession,
  breakdownBySymbol,
} from "@/lib/journal/metrics";
import { calculateTraderIndex } from "@/lib/journal/trader-index";
import { DEFAULT_TRADING_CONFIG } from "@/lib/trading-config";
import type { Trade } from "@/lib/journal/types";
import type { Task } from "@/lib/tasks/types";

export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  data?: unknown;
}

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  userId: string;
  accountId?: string | null;
}

export const ZENITH_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_trades",
    description:
      "Query trades from the user's trading journal with optional filters for symbol, session, setup, direction, and status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: "Maximum trades to retrieve (default 20, max 100)",
        },
        symbol: {
          type: SchemaType.STRING,
          description: "Filter by trading symbol, e.g. XAUUSD, EURUSD, BTCUSD, US30",
        },
        session: {
          type: SchemaType.STRING,
          description: "Filter by session: 'Asia', 'London', 'New York', or 'Other'",
        },
        setup: {
          type: SchemaType.STRING,
          description: "Filter by trade setup or strategy name",
        },
        direction: {
          type: SchemaType.STRING,
          description: "Filter by 'LONG' or 'SHORT'",
        },
        status: {
          type: SchemaType.STRING,
          description: "Filter by 'open' or 'closed'",
        },
      },
    },
  },
  {
    name: "get_performance_metrics",
    description:
      "Compute institutional performance metrics across closed trades (Win Rate, Profit Factor, Net P&L, Expectancy, Average Win/Loss, R-Multiple, Max Drawdown, Streaks).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: {
          type: SchemaType.STRING,
          description: "Optional symbol filter to compute metrics for a specific asset",
        },
      },
    },
  },
  {
    name: "get_breakdowns",
    description:
      "Get performance breakdowns grouped by setup, session, or symbol to detect edges and behavioral leaks.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        by: {
          type: SchemaType.STRING,
          description: "Grouping category: 'setup', 'session', or 'symbol'",
        },
      },
      required: ["by"],
    },
  },
  {
    name: "get_trader_index",
    description:
      "Calculate the 0-100 Trader Index (Discipline Score) measuring risk consistency, rule adherence, emotional control, revenge trading discipline, and active violation alerts.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_tasks",
    description:
      "Retrieve the user's current task list and to-do items from the productivity tracker.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: "Filter by status: 'todo', 'in_progress', or 'done'",
        },
        category: {
          type: SchemaType.STRING,
          description: "Filter by category: 'trading', 'health', 'work', 'personal', 'learning', 'finance'",
        },
      },
    },
  },
  {
    name: "log_trade",
    description:
      "Directly log a trade into the user's trading journal database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: "Asset symbol, e.g. XAUUSD" },
        direction: { type: SchemaType.STRING, description: "'LONG' or 'SHORT'" },
        entry_price: { type: SchemaType.NUMBER, description: "Entry price" },
        stop_loss: { type: SchemaType.NUMBER, description: "Stop loss price" },
        take_profit: { type: SchemaType.NUMBER, description: "Take profit price" },
        exit_price: { type: SchemaType.NUMBER, description: "Exit price (if closed)" },
        pnl: { type: SchemaType.NUMBER, description: "Net profit or loss in dollars" },
        setup: { type: SchemaType.STRING, description: "Setup name, e.g. Order Block, Liquidity Sweep" },
        session: { type: SchemaType.STRING, description: "Trading session: Asia, London, New York, or Other" },
        notes: { type: SchemaType.STRING, description: "Trade notes or reasoning" },
      },
      required: ["symbol", "direction", "entry_price"],
    },
  },
  {
    name: "create_task",
    description: "Create an actionable task or trading reminder for the user.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Task title" },
        priority: {
          type: SchemaType.STRING,
          description: "Priority: 'low', 'medium', 'high', or 'urgent'",
        },
        category: {
          type: SchemaType.STRING,
          description: "Category: 'trading', 'health', 'work', 'personal', 'learning', 'finance'",
        },
        due_date: {
          type: SchemaType.STRING,
          description: "Due date in YYYY-MM-DD format (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "calculate_position_size",
    description:
      "Calculate exact institutional position lot size for Gold (XAUUSD), Forex pairs, or Cent Accounts given risk amount in dollars and stop loss distance.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: "Symbol, e.g. XAUUSD, EURUSD, GBPUSD" },
        riskAmount: { type: SchemaType.NUMBER, description: "Risk in dollars ($), e.g. 200" },
        stopLossPips: { type: SchemaType.NUMBER, description: "Stop loss distance in pips or points (e.g. 25 pips, or $2.50 in Gold = 25 pips)" },
        accountType: { type: SchemaType.STRING, description: "'standard' (default) or 'cent'" },
      },
      required: ["symbol", "riskAmount", "stopLossPips"],
    },
  },
];

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<{ summary: string; data: Record<string, unknown> }> {
  const { supabase, userId, accountId } = ctx;

  switch (toolName) {
    case "get_trades": {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      let query = supabase
        .from("trades")
        .select("id, symbol, direction, entry_price, exit_price, stop_loss, take_profit, pnl, r_multiple, setup, session, status, entry_time, mistakes")
        .eq("user_id", userId);

      if (accountId && accountId !== "all") {
        query = query.eq("account_id", accountId);
      }
      if (args.symbol && typeof args.symbol === "string") {
        query = query.ilike("symbol", `%${args.symbol.trim()}%`);
      }
      if (args.session && typeof args.session === "string") {
        query = query.eq("session", args.session);
      }
      if (args.setup && typeof args.setup === "string") {
        query = query.ilike("setup", `%${args.setup.trim()}%`);
      }
      if (args.direction && typeof args.direction === "string") {
        query = query.eq("direction", args.direction.toUpperCase());
      }
      if (args.status && typeof args.status === "string") {
        query = query.eq("status", args.status.toLowerCase());
      }

      const { data, error } = await query
        .order("entry_time", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          summary: `Error querying trades: ${error.message}`,
          data: { error: error.message },
        };
      }

      const trades = (data ?? []) as Trade[];
      const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;

      return {
        summary: `Found ${trades.length} trades (Wins: ${wins}, Total P&L: $${totalPnl.toFixed(2)})`,
        data: {
          count: trades.length,
          totalPnl,
          wins,
          trades: trades.slice(0, 25),
        },
      };
    }

    case "get_performance_metrics": {
      let query = supabase.from("trades").select("*").eq("user_id", userId);
      if (accountId && accountId !== "all") {
        query = query.eq("account_id", accountId);
      }
      if (args.symbol && typeof args.symbol === "string") {
        query = query.ilike("symbol", `%${args.symbol.trim()}%`);
      }

      const { data, error } = await query.order("entry_time", { ascending: true });
      if (error) {
        return { summary: `Error fetching metrics: ${error.message}`, data: { error: error.message } };
      }

      const trades = (data ?? []) as Trade[];
      const metrics = calculateMetrics(trades);
      const drawdown = calculateDrawdown(trades);
      const streak = currentStreak(trades);

      return {
        summary: `Computed metrics across ${metrics.closedTrades} closed trades: Win Rate ${(metrics.winRate * 100).toFixed(1)}%, Profit Factor ${metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)}, Net P&L $${metrics.netPnl.toFixed(2)}`,
        data: {
          totalTrades: metrics.totalTrades,
          closedTrades: metrics.closedTrades,
          winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
          profitFactor: metrics.profitFactor === Infinity ? "Infinity" : Number(metrics.profitFactor.toFixed(2)),
          netPnl: Number(metrics.netPnl.toFixed(2)),
          expectancy: Number(metrics.expectancy.toFixed(2)),
          avgWin: Number(metrics.avgWin.toFixed(2)),
          avgLoss: Number(metrics.avgLoss.toFixed(2)),
          avgRMultiple: Number(metrics.avgRMultiple.toFixed(2)),
          bestTrade: Number(metrics.bestTrade.toFixed(2)),
          worstTrade: Number(metrics.worstTrade.toFixed(2)),
          maxDrawdown: Number(drawdown.maxDrawdown.toFixed(2)),
          maxDrawdownPct: `${(drawdown.maxDrawdownPct * 100).toFixed(1)}%`,
          currentStreak: streak,
          winStreak: metrics.maxWinStreak,
          lossStreak: metrics.maxLossStreak,
        },
      };
    }

    case "get_breakdowns": {
      const by = (typeof args.by === "string" ? args.by.toLowerCase() : "setup") as "setup" | "session" | "symbol";
      let query = supabase.from("trades").select("*").eq("user_id", userId);
      if (accountId && accountId !== "all") {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query.order("entry_time", { ascending: true });
      if (error) {
        return { summary: `Error generating breakdown: ${error.message}`, data: { error: error.message } };
      }

      const trades = (data ?? []) as Trade[];
      let breakdown;
      if (by === "session") breakdown = breakdownBySession(trades);
      else if (by === "symbol") breakdown = breakdownBySymbol(trades);
      else breakdown = breakdownBySetup(trades);

      return {
        summary: `Analyzed breakdown by ${by} (${breakdown.length} categories found)`,
        data: {
          by,
          breakdown: breakdown.map((b) => ({
            name: b.key,
            trades: b.trades,
            winRate: `${(b.winRate * 100).toFixed(1)}%`,
            netPnl: Number(b.netPnl.toFixed(2)),
            avgR: Number(b.avgR.toFixed(2)),
          })),
        },
      };
    }

    case "get_trader_index": {
      let query = supabase.from("trades").select("*").eq("user_id", userId);
      if (accountId && accountId !== "all") {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query.order("entry_time", { ascending: true });
      if (error) {
        return { summary: `Error calculating Trader Index: ${error.message}`, data: { error: error.message } };
      }

      const trades = (data ?? []) as Trade[];
      const ti = calculateTraderIndex(trades, DEFAULT_TRADING_CONFIG);

      return {
        summary: `Trader Index: ${ti.breakdown.overall}/100 (Grade ${ti.breakdown.grade}) with ${ti.alerts.length} active alerts`,
        data: {
          overallScore: ti.breakdown.overall,
          grade: ti.breakdown.grade,
          riskConsistency: ti.breakdown.riskConsistency,
          ruleAdherence: ti.breakdown.ruleAdherence,
          emotionalControl: ti.breakdown.emotionalControl,
          revengeDiscipline: ti.breakdown.revengeDiscipline,
          activeAlerts: ti.alerts.slice(0, 5).map((a) => ({
            severity: a.severity,
            title: a.title,
            description: a.description,
          })),
        },
      };
    }

    case "get_tasks": {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (args.status && typeof args.status === "string") {
        query = query.eq("status", args.status.toLowerCase());
      }
      if (args.category && typeof args.category === "string") {
        query = query.eq("category", args.category.toLowerCase());
      }

      const { data, error } = await query.limit(20);
      if (error) {
        return { summary: `Error fetching tasks: ${error.message}`, data: { error: error.message } };
      }

      const tasks = (data ?? []) as Task[];
      return {
        summary: `Found ${tasks.length} tasks`,
        data: {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            category: t.category,
            status: t.status,
            due_date: t.due_date,
          })),
        },
      };
    }

    case "log_trade": {
      const symbol = String(args.symbol || "").toUpperCase();
      const direction = (String(args.direction || "LONG").toUpperCase() === "SHORT" ? "SHORT" : "LONG") as "LONG" | "SHORT";
      const entry_price = Number(args.entry_price) || 0;
      const exit_price = args.exit_price != null ? Number(args.exit_price) : null;
      const stop_loss = args.stop_loss != null ? Number(args.stop_loss) : null;
      const take_profit = args.take_profit != null ? Number(args.take_profit) : null;
      const pnl = args.pnl != null ? Number(args.pnl) : null;
      const setup = args.setup ? String(args.setup) : null;
      const session = ["Asia", "London", "New York", "Other"].includes(String(args.session))
        ? (String(args.session) as "Asia" | "London" | "New York" | "Other")
        : null;
      const notes = args.notes ? String(args.notes) : "Logged by Zenith Agent";

      const { data, error } = await supabase
        .from("trades")
        .insert({
          user_id: userId,
          account_id: accountId && accountId !== "all" ? accountId : null,
          symbol,
          direction,
          entry_price,
          exit_price,
          stop_loss,
          take_profit,
          pnl,
          setup,
          session,
          notes,
          status: exit_price != null ? "closed" : "open",
          entry_time: new Date().toISOString(),
          exit_time: exit_price != null ? new Date().toISOString() : null,
          quantity: 0,
        })
        .select("id")
        .single();

      if (error) {
        return { summary: `Failed to log trade: ${error.message}`, data: { error: error.message } };
      }

      return {
        summary: `Successfully logged ${direction} trade on ${symbol} @ ${entry_price}${pnl != null ? ` (P&L: $${pnl})` : ""}`,
        data: { success: true, tradeId: data.id, symbol, direction, entry_price, pnl },
      };
    }

    case "create_task": {
      const title = String(args.title || "").trim();
      if (!title) {
        return { summary: "Task creation failed: title is required", data: { error: "Missing title" } };
      }
      const priority = ["low", "medium", "high", "urgent"].includes(String(args.priority))
        ? String(args.priority)
        : "medium";
      const category = ["trading", "health", "work", "personal", "learning", "finance"].includes(String(args.category))
        ? String(args.category)
        : "trading";
      const due_date = args.due_date ? String(args.due_date) : null;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title,
          priority,
          category,
          due_date,
          status: "todo",
        })
        .select("id")
        .single();

      if (error) {
        return { summary: `Failed to create task: ${error.message}`, data: { error: error.message } };
      }

      return {
        summary: `Created task: "${title}" [${priority.toUpperCase()} · ${category}]`,
        data: { success: true, taskId: data.id, title, priority, category },
      };
    }

    case "calculate_position_size": {
      const symbol = String(args.symbol || "").toUpperCase();
      const riskAmount = Math.max(Number(args.riskAmount) || 0, 0);
      const stopLossPips = Math.max(Number(args.stopLossPips) || 0.1, 0.1);
      const accountType = String(args.accountType || "standard").toLowerCase();

      let pipValuePerStandardLot = 10;
      if (symbol.includes("XAU") || symbol.includes("GOLD")) {
        pipValuePerStandardLot = 10;
      } else if (symbol.includes("JPY")) {
        pipValuePerStandardLot = 9.2;
      } else if (symbol.includes("BTC")) {
        pipValuePerStandardLot = 1;
      }

      const totalPipRisk = stopLossPips * pipValuePerStandardLot;
      let calculatedLotSize = totalPipRisk > 0 ? riskAmount / totalPipRisk : 0;

      if (accountType === "cent") {
        calculatedLotSize = calculatedLotSize * 100;
      }

      const roundedLot = Math.round(calculatedLotSize * 100) / 100;

      return {
        summary: `Calculated position size for ${symbol}: ${roundedLot} lots ($${riskAmount} risk with ${stopLossPips} pips SL)`,
        data: {
          symbol,
          riskAmount,
          stopLossPips,
          accountType,
          lotSize: roundedLot,
          details: `At $${riskAmount} total risk with a ${stopLossPips} pip stop loss, trade size is ${roundedLot} ${accountType === "cent" ? "Cent Lots" : "Standard Lots"}.`,
        },
      };
    }

    default:
      return {
        summary: `Tool ${toolName} not found`,
        data: { error: `Unknown tool: ${toolName}` },
      };
  }
}
