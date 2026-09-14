"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  chatWithAgent,
  type AgentAction,
  type ParsedTask,
  type ParsedTrade,
} from "@/lib/zenith/zenith-agent";
import type { AgentStep } from "@/lib/zenith/agent-tools";
import { createTrade } from "@/lib/journal/actions";
import { createTask } from "@/lib/tasks/actions";
import { getActiveAccountId } from "@/lib/accounts/active-account";
import {
  Zap,
  MessageSquare,
  Send,
  Loader2,
  RotateCcw,
  Wrench,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Calculator,
  Brain,
} from "lucide-react";

interface ConsoleMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  loading?: boolean;
  steps?: AgentStep[];
  action?: AgentAction;
  actionNote?: string;
  timestamp: string;
}

const FORENSIC_TEMPLATES = [
  {
    icon: <TrendingUp className="w-3.5 h-3.5 text-profit" />,
    title: "Edge vs Leaks Audit",
    prompt: "Audit my trade performance by setup and session. What is my highest expectancy setup, and which session is leaking profit?",
  },
  {
    icon: <AlertTriangle className="w-3.5 h-3.5 text-warning" />,
    title: "Revenge & Discipline Check",
    prompt: "Inspect my Trader Index and recent loss streaks. Have I exhibited any signs of revenge trading, oversized positions, or FOMO entries?",
  },
  {
    icon: <ShieldCheck className="w-3.5 h-3.5 text-info" />,
    title: "Weekly Performance Debrief",
    prompt: "Give me an executive debrief of my recent trades: win rate, profit factor, best trade, worst trade, and the #1 adjustment I need to make.",
  },
  {
    icon: <Calculator className="w-3.5 h-3.5 text-brand" />,
    title: "Gold (XAUUSD) Position Sizing",
    prompt: "Calculate position size for XAUUSD with $250 risk and a 20 pip stop loss on a standard account.",
  },
];

export function ZenithAgentConsole() {
  const [mode, setMode] = useState<"agent" | "chat">("agent");
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: "console-welcome",
      role: "agent",
      text: "Welcome to the Velox Zenith Agent Console. I am connected directly to your trading journal database with live multi-step function calling capabilities.\n\nAsk me to query your trades, analyze win rates by setup/session, calculate discipline scores, calculate exact lot sizes, or log trades and tasks directly into your account.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const updateMessage = (id: string, update: Partial<ConsoleMessage>) => {
    setMessages((current) =>
      current.map((m) => (m.id === id ? { ...m, ...update } : m)),
    );
  };

  const handleConfirmTrade = async (id: string, data: ParsedTrade) => {
    const session = ["Asia", "London", "New York", "Other"].includes(data.session ?? "")
      ? (data.session as "Asia" | "London" | "New York" | "Other")
      : null;
    const result = await createTrade({
      symbol: data.symbol,
      direction: data.direction,
      entry_price: data.entry_price ?? 0,
      stop_loss: data.stop_loss,
      take_profit: data.take_profit,
      exit_price: data.exit_price,
      pnl: data.pnl,
      setup: data.setup,
      session,
      entry_time: new Date().toISOString(),
      exit_time: data.exit_price != null ? new Date().toISOString() : null,
      quantity: 0,
      r_multiple: null,
      mae: null,
      mfe: null,
      market_condition: null,
      confidence: null,
      emotion_before: null,
      emotion_after: null,
      mistakes: null,
      partials: null,
      confluences: null,
      notes: "Logged via Zenith Agent Console",
      status: data.exit_price != null ? "closed" : "open",
      account_id: getActiveAccountId() === "all" ? null : getActiveAccountId(),
    });

    if (result.error) {
      updateMessage(id, { action: undefined, actionNote: `Failed: ${result.error}` });
    } else {
      updateMessage(id, { action: undefined, actionNote: "Trade logged to journal successfully." });
    }
  };

  const handleConfirmTask = async (id: string, data: ParsedTask) => {
    const result = await createTask({
      title: data.title,
      priority: data.priority,
      category: data.category,
      due_date: data.due_date,
    });

    if (result.error) {
      updateMessage(id, { action: undefined, actionNote: `Failed: ${result.error}` });
    } else {
      updateMessage(id, { action: undefined, actionNote: "Task created successfully." });
    }
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending) return;
      setInput("");
      setSending(true);

      const userMsg: ConsoleMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((current) => [...current, userMsg]);

      const loadingId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        {
          id: loadingId,
          role: "agent",
          text: "",
          loading: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      const history = messages
        .filter((m) => !m.loading)
        .map((m) => ({ role: m.role, text: m.text }));

      const activeAcc = getActiveAccountId();
      const result = await chatWithAgent(text, history, {
        mode,
        accountId: activeAcc === "all" ? null : activeAcc,
      });

      setMessages((current) =>
        current.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                text: result.text,
                loading: false,
                steps: result.steps,
                action: result.action,
              }
            : m,
        ),
      );

      setSending(false);
    },
    [input, messages, mode, sending],
  );

  const resetSession = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "agent",
        text: "Agent session reset. Ready for your next query or audit task.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Quick Template Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FORENSIC_TEMPLATES.map((tmpl, idx) => (
          <button
            key={idx}
            onClick={() => void handleSend(tmpl.prompt)}
            disabled={sending}
            className="flex flex-col items-start p-3.5 rounded-xl border border-border/70 bg-surface/80 hover:bg-surface-2 hover:border-brand/40 transition-all text-left group shadow-xs"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-surface-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                {tmpl.icon}
              </div>
              <p className="text-xs font-bold text-foreground group-hover:text-brand transition-colors">
                {tmpl.title}
              </p>
            </div>
            <p className="text-[11px] text-foreground-subtle line-clamp-2 leading-relaxed">
              {tmpl.prompt}
            </p>
          </button>
        ))}
      </div>

      {/* Main Terminal Console */}
      <Card glass className="border-brand/20 shadow-xl overflow-hidden">
        {/* Terminal Header */}
        <CardHeader className="border-b border-border/80 bg-surface-2/40 py-3.5 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
                <Brain className="w-5 h-5 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold">Interactive Agent Terminal</CardTitle>
                  <Badge variant="brand" className="text-[10px]">
                    Autonomous Functions
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Connected to journal database · Real-time multi-turn reasoning
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mode Selector */}
              <div className="flex items-center p-0.5 rounded-lg bg-surface-3/80 border border-border/80 text-xs">
                <button
                  onClick={() => setMode("agent")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md transition-all text-xs font-semibold",
                    mode === "agent"
                      ? "bg-brand text-white shadow-xs"
                      : "text-foreground-subtle hover:text-foreground",
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Agent Mode
                </button>
                <button
                  onClick={() => setMode("chat")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md transition-all text-xs font-semibold",
                    mode === "chat"
                      ? "bg-brand text-white shadow-xs"
                      : "text-foreground-subtle hover:text-foreground",
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat Mode
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetSession}
                className="text-xs text-foreground-subtle hover:text-foreground"
                title="Reset session history"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Terminal Chat Stream */}
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="h-[480px] sm:h-[540px] overflow-y-auto p-4 sm:p-6 space-y-5"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col space-y-1.5",
                  m.role === "user" ? "items-end" : "items-start",
                )}
              >
                {/* Reasoning Steps Badges */}
                {m.role === "agent" && m.steps && m.steps.length > 0 && (
                  <div className="space-y-1.5 mb-1 max-w-[90%]">
                    {m.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/25 text-xs text-foreground shadow-xs"
                      >
                        <Wrench className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="font-mono text-brand font-bold text-[11px]">
                          {step.tool}
                        </span>
                        <span className="text-foreground-subtle truncate text-[11px]">
                          → {step.summary}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl p-4 text-[13px] sm:text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "bg-brand text-white rounded-br-xs"
                      : "bg-surface-2 border border-border/70 text-foreground rounded-bl-xs",
                  )}
                >
                  {m.loading ? (
                    <div className="flex items-center gap-3 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-brand" />
                      <span className="text-foreground-subtle text-xs">
                        {mode === "agent"
                          ? "Executing database tools and synthesizing analysis…"
                          : "Thinking…"}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="prose prose-sm prose-invert max-w-none text-inherit [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 whitespace-pre-wrap">
                        {m.text}
                      </div>

                      {/* Trade Action Confirmation */}
                      {m.action?.type === "trade" && (
                        <div className="mt-3 border border-border/90 rounded-xl p-3.5 bg-surface-3/60 space-y-2.5 text-foreground">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-brand flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Ready to Log Trade
                            </p>
                            <span className="text-[11px] font-mono font-bold uppercase text-foreground-subtle">
                              {m.action.data.direction}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs py-1">
                            <div>
                              <span className="text-foreground-subtle">Symbol:</span>{" "}
                              {m.action.data.symbol}
                            </div>
                            {m.action.data.entry_price != null && (
                              <div>
                                <span className="text-foreground-subtle">Entry:</span>{" "}
                                {m.action.data.entry_price}
                              </div>
                            )}
                            {m.action.data.pnl != null && (
                              <div>
                                <span className="text-foreground-subtle">P&amp;L:</span>{" "}
                                ${m.action.data.pnl}
                              </div>
                            )}
                            {m.action.data.setup && (
                              <div>
                                <span className="text-foreground-subtle">Setup:</span>{" "}
                                {m.action.data.setup}
                              </div>
                            )}
                            {m.action.data.session && (
                              <div>
                                <span className="text-foreground-subtle">Session:</span>{" "}
                                {m.action.data.session}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                void handleConfirmTrade(
                                  m.id,
                                  (m.action as { data: ParsedTrade }).data,
                                )
                              }
                            >
                              Confirm &amp; Log to Journal
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateMessage(m.id, {
                                  action: undefined,
                                  actionNote: "Dismissed.",
                                })
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Task Action Confirmation */}
                      {m.action?.type === "task" && (
                        <div className="mt-3 border border-border/90 rounded-xl p-3.5 bg-surface-3/60 space-y-2 text-foreground">
                          <p className="text-xs font-bold text-brand flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Create Task
                          </p>
                          <p className="text-xs font-semibold">{m.action.data.title}</p>
                          <div className="text-[11px] text-foreground-subtle">
                            Priority: {m.action.data.priority} · Category: {m.action.data.category}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                void handleConfirmTask(
                                  m.id,
                                  (m.action as { data: ParsedTask }).data,
                                )
                              }
                            >
                              Create Task
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateMessage(m.id, {
                                  action: undefined,
                                  actionNote: "Dismissed.",
                                })
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}

                      {m.actionNote && (
                        <p className="mt-2 text-xs text-brand font-medium">✓ {m.actionNote}</p>
                      )}
                    </>
                  )}
                </div>
                <span className="text-[10px] text-foreground-subtle px-1">{m.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Terminal Input Footer */}
          <div className="p-3 sm:p-4 border-t border-border/80 bg-surface-2/40">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  placeholder={
                    mode === "agent"
                      ? "Ask Agent to audit trades, inspect session bias, calculate lot sizing, or log actions... (Enter to send, Shift+Enter for newline)"
                      : "Ask any trading, strategy, or psychology question..."
                  }
                  disabled={sending}
                  className="w-full resize-none rounded-xl bg-surface border border-border/80 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-50 placeholder:text-foreground-subtle text-foreground leading-relaxed"
                />
              </div>
              <Button
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                size="default"
                className="h-11 px-4 rounded-xl"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
