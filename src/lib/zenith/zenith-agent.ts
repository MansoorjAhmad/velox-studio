"use client";

import type { AgentStep } from "./agent-tools";

export interface ParsedTrade {
  symbol: string;
  direction: "LONG" | "SHORT";
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  pnl: number | null;
  setup: string | null;
  session: string | null;
}

export interface ParsedTask {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: "trading" | "health" | "work" | "personal" | "learning" | "finance";
  due_date: string | null;
}

export type AgentAction =
  | { type: "trade"; data: ParsedTrade; display: string }
  | { type: "task"; data: ParsedTask; display: string }
  | { type: "routine"; display: string }
  | { type: "none"; display: string };

export interface ChatAgentResult {
  text: string;
  steps?: AgentStep[];
  action: AgentAction;
  error?: string;
}

export interface ChatAgentOptions {
  mode?: "agent" | "chat";
  accountId?: string | null;
}

export async function chatWithAgent(
  message: string,
  history: { role: string; text: string }[],
  options?: ChatAgentOptions,
): Promise<ChatAgentResult> {
  const mode = options?.mode ?? "agent";

  try {
    const res = await fetch("/api/zenith", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        userMessage: message,
        conversationHistory: history.slice(-10),
        accountId: options?.accountId,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        text:
          errData.error ||
          "I'm having trouble connecting to Zenith right now. Please try again in a moment.",
        steps: [],
        action: { type: "none", display: "" },
        error: errData.error,
      };
    }

    const data = await res.json();
    const text = data.text || "No response received.";
    const steps: AgentStep[] = Array.isArray(data.steps) ? data.steps : [];

    return {
      text,
      steps,
      action: parseAction(text),
    };
  } catch (err) {
    console.error("Failed to chat with Zenith Agent:", err);
    return {
      text: "Unable to reach the Zenith Agent engine. Please check your network connection or API settings.",
      steps: [],
      action: { type: "none", display: "" },
      error: String(err),
    };
  }
}

export function parseAction(text: string): AgentAction {
  const tradeMatch = text.match(
    /([A-Z]{3,6})\s*\|\s*(LONG|SHORT)\s*\|\s*([\d.]+|-)\s*\|\s*([\d.]+|-)\s*\|\s*([\d.]+|-)\s*\|\s*([\d.]+|-)\s*\|\s*(-?[\d.]+|-)\s*\|\s*([^|]+)\s*\|\s*([^\n|]+)/i,
  );
  if (tradeMatch) {
    const [, symbol, direction, entry, stop, tp, exit, pnl, setup, session] = tradeMatch;
    const numberOrNull = (value: string) => {
      const number = value === "-" ? null : Number.parseFloat(value);
      return number != null && Number.isFinite(number) ? number : null;
    };
    return {
      type: "trade",
      data: {
        symbol: symbol.toUpperCase(),
        direction: direction.toUpperCase() as "LONG" | "SHORT",
        entry_price: numberOrNull(entry),
        stop_loss: numberOrNull(stop),
        take_profit: numberOrNull(tp),
        exit_price: numberOrNull(exit),
        pnl: numberOrNull(pnl),
        setup: setup.trim() || null,
        session: session.trim() || null,
      },
      display: text,
    };
  }

  const taskMatch = text.match(
    /TASK:\s*(.+?)\s*\|\s*PRIORITY:\s*(low|medium|high|urgent)\s*\|\s*CATEGORY:\s*(trading|health|work|personal|learning|finance)\s*\|\s*DUE:\s*([^\n]+)/i,
  );
  if (taskMatch) {
    const [, title, priority, category, due] = taskMatch;
    const dueValue = due.trim();
    return {
      type: "task",
      data: {
        title: title.trim(),
        priority: priority.toLowerCase() as ParsedTask["priority"],
        category: category.toLowerCase() as ParsedTask["category"],
        due_date: dueValue.toLowerCase() === "none" ? null : dueValue,
      },
      display: text,
    };
  }

  if (/routine|schedule|daily\s*plan/i.test(text)) return { type: "routine", display: text };
  return { type: "none", display: text };
}
