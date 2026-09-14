"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  chatWithAgent,
  type AgentAction,
  type ParsedTask,
  type ParsedTrade,
} from "@/lib/zenith/zenith-agent";
import type { AgentStep } from "@/lib/zenith/agent-tools";
import { createTask } from "@/lib/tasks/actions";
import { createTrade } from "@/lib/journal/actions";
import { getActiveAccountId } from "@/lib/accounts/active-account";
import {
  Clock3,
  History,
  Loader2,
  Minimize2,
  Maximize2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
  Zap,
  MessageSquare,
  Wrench,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createConversation,
  deleteConversation,
  listConversations,
  loadConversationMessages,
  saveMessageToConversation,
  type Conversation,
} from "@/lib/zenith/history";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  loading?: boolean;
  steps?: AgentStep[];
  action?: AgentAction;
  actionNote?: string;
  timestamp?: string;
}

const welcomeMessage = (mode: "agent" | "chat"): Message => ({
  id: "welcome",
  role: "agent",
  text:
    mode === "agent"
      ? "Autonomous Trading Agent online.\n\nI can inspect your live journal, audit setups, verify discipline rules, compute position sizing, or log trades and tasks directly. What would you like to inspect?"
      : "Trading Copilot online.\n\nAsk me anything about risk management, ICT concepts, session mechanics, or lot sizing formulas. How can I help today?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Audit my win rate on XAUUSD", text: "Audit my win rate and P&L on XAUUSD" },
  { icon: AlertTriangle, label: "What is my biggest loss this week?", text: "What is my biggest loss this week?" },
  { icon: Calculator, label: "Calculate Gold lot size", text: "Calculate lot size for $300 risk on Gold with 20 pips stop loss" },
  { icon: Sparkles, label: "Check my Trader Index", text: "What is my current Trader Index score and discipline breakdown?" },
];

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ZenithAgent() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<"agent" | "chat">("agent");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  const startNewChat = useCallback(async () => {
    const id = await createConversation();
    if (!id) return;
    setConversationId(id);
    setMessages([welcomeMessage(mode)]);
    setView("chat");
    await refreshConversations();
  }, [mode, refreshConversations]);

  const openConversation = useCallback(
    async (id: string) => {
      const stored = await loadConversationMessages(id);
      setConversationId(id);
      setMessages(stored.length ? stored : [welcomeMessage(mode)]);
      setView("chat");
    },
    [mode],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, view, sending]);

  useEffect(() => {
    if (open && !minimized && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, minimized, view]);

  useEffect(() => {
    if (!open || historyLoaded) return;
    void (async () => {
      const items = await listConversations();
      setConversations(items);
      if (items[0]) await openConversation(items[0].id);
      else await startNewChat();
      setHistoryLoaded(true);
    })();
  }, [open, historyLoaded, openConversation, startNewChat]);

  const updateMessage = (id: string, update: Partial<Message>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  };

  const handleActionConfirmed = (id: string, note: string) => {
    updateMessage(id, { action: undefined, actionNote: note });
  };

  const handleActionError = (id: string, error: string) => {
    updateMessage(id, { action: undefined, actionNote: `Failed: ${error}` });
  };

  const handleDismissAction = (id: string) => {
    updateMessage(id, { action: undefined, actionNote: "Dismissed." });
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
      notes: "Logged via Zenith Agent",
      status: data.exit_price != null ? "closed" : "open",
      account_id: getActiveAccountId() === "all" ? null : getActiveAccountId(),
    });
    if (result.error) handleActionError(id, result.error);
    else handleActionConfirmed(id, "Trade logged to journal.");
  };

  const handleConfirmTask = async (id: string, data: ParsedTask) => {
    const result = await createTask({
      title: data.title,
      priority: data.priority,
      category: data.category,
      due_date: data.due_date,
    });
    if (result.error) handleActionError(id, result.error);
    else handleActionConfirmed(id, "Task created.");
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending || !conversationId) return;
      setInput("");
      setSending(true);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((current) => [...current, userMsg]);
      void saveMessageToConversation(conversationId, "user", text);

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
        .filter((message) => !message.loading)
        .map((message) => ({ role: message.role, text: message.text }));

      const activeAccountId = getActiveAccountId();
      const result = await chatWithAgent(text, history, {
        mode,
        accountId: activeAccountId === "all" ? null : activeAccountId,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                text: result.text,
                loading: false,
                steps: result.steps,
                action: result.action,
              }
            : message,
        ),
      );

      void saveMessageToConversation(conversationId, "agent", result.text);
      void refreshConversations();
      setSending(false);
    },
    [conversationId, input, messages, mode, refreshConversations, sending],
  );

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm("Delete this conversation and all its messages? This cannot be undone.")) {
      return;
    }
    await deleteConversation(id);
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setConversations(remaining);
    if (id === conversationId) {
      setConversationId(null);
      await startNewChat();
    }
  };

  // Minimized floating launcher button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-13 h-13 rounded-full bg-brand flex items-center justify-center shadow-xl shadow-brand/30 hover:scale-105 active:scale-95 transition-all md:bottom-6 md:right-6 group border border-white/10"
        title="Open Zenith Agent"
      >
        <Sparkles className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-out",
        minimized
          ? "bottom-20 right-4 md:bottom-6 md:right-6 w-13 h-13"
          : isExpanded
            ? "bottom-4 right-4 md:bottom-6 md:right-6 w-[min(820px,calc(100vw-2rem))] h-[min(740px,calc(100svh-4rem))]"
            : "bottom-20 right-4 md:bottom-6 md:right-6 w-[min(440px,calc(100vw-1.5rem))] h-[min(580px,calc(100svh-6rem))]",
      )}
    >
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          className="w-13 h-13 rounded-full bg-brand flex items-center justify-center shadow-xl hover:scale-105 transition-all border border-white/10"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      ) : (
        <div className="flex flex-col h-full rounded-2xl border border-border/80 bg-surface/98 backdrop-blur-2xl shadow-2xl overflow-hidden">
          {/* Header Row 1: Brand & Window Controls */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-surface-2/60">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-profit ring-2 ring-surface" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-foreground tracking-tight">Zenith Agent</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand/15 text-brand border border-brand/20">
                    2.0
                  </span>
                </div>
                <p className="text-[10px] text-foreground-subtle">Institutional Trading Copilot</p>
              </div>
            </div>

            {/* Window control buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  void refreshConversations();
                  setView(view === "chat" ? "history" : "chat");
                }}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Conversation history"
              >
                <History className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => void startNewChat()}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="New chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors hidden sm:inline-flex"
                title={isExpanded ? "Collapse" : "Expand window"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Header Row 2: Clean Segmented Mode Control */}
          <div className="px-4 py-2 border-b border-border/50 bg-surface/80">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2/80 border border-border/60">
              <button
                onClick={() => setMode("agent")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                  mode === "agent"
                    ? "bg-brand text-white shadow-xs"
                    : "text-foreground-subtle hover:text-foreground",
                )}
                title="Autonomous Agent: executes real queries on trades, metrics, and risk"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Agent Mode</span>
              </button>
              <button
                onClick={() => setMode("chat")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                  mode === "chat"
                    ? "bg-brand text-white shadow-xs"
                    : "text-foreground-subtle hover:text-foreground",
                )}
                title="Fast Copilot: trading advice, psychology, and risk calculations"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat Mode</span>
              </button>
            </div>
          </div>

          {/* Main Body */}
          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <Button size="sm" className="w-full mb-3" onClick={() => void startNewChat()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New conversation
              </Button>
              {conversations.length === 0 ? (
                <p className="p-4 text-xs text-center text-foreground-subtle">
                  No conversations yet.
                </p>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center gap-1 rounded-xl border border-border/50 hover:bg-surface-2/80 transition-colors p-1"
                  >
                    <button
                      className="flex-1 min-w-0 text-left px-3 py-2"
                      onClick={() => void openConversation(conversation.id)}
                    >
                      <p className="truncate text-xs font-semibold text-foreground">
                        {conversation.title}
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-foreground-subtle mt-0.5">
                        <Clock3 className="w-3 h-3" />
                        {timeAgo(conversation.updated_at)} ago
                      </p>
                    </button>
                    <button
                      className="p-2 text-foreground-subtle hover:text-loss transition-colors"
                      onClick={() => void handleDeleteConversation(conversation.id)}
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col space-y-1",
                      message.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {/* Tool Execution Reasoning Badges */}
                    {message.role === "agent" && message.steps && message.steps.length > 0 && (
                      <div className="space-y-1 mb-1 max-w-[95%]">
                        {message.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-[11px] text-foreground shadow-xs"
                          >
                            <Wrench className="w-3 h-3 text-brand shrink-0" />
                            <span className="font-mono text-brand font-bold">{step.tool}</span>
                            <span className="text-foreground-subtle truncate">→ {step.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs",
                        message.role === "user"
                          ? "bg-brand text-white rounded-br-xs font-medium"
                          : "bg-surface-2 border border-border/70 text-foreground rounded-bl-xs",
                      )}
                    >
                      {message.loading ? (
                        <div className="flex items-center gap-2.5 py-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                          <span className="text-foreground-subtle text-xs">
                            {mode === "agent" ? "Executing tools & synthesizing…" : "Thinking…"}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap">{message.text}</div>

                          {/* Trade Action Confirmation Card */}
                          {message.action?.type === "trade" && (
                            <div className="mt-2.5 border border-border/80 rounded-xl p-3 bg-surface-3/50 space-y-2 text-foreground">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-brand flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Log Trade
                                </p>
                                <span className="text-[10px] font-mono font-bold uppercase text-foreground-subtle">
                                  {message.action.data.direction}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono grid grid-cols-2 gap-1 py-0.5">
                                <div>
                                  <span className="text-foreground-subtle">Symbol:</span>{" "}
                                  {message.action.data.symbol}
                                </div>
                                {message.action.data.entry_price != null && (
                                  <div>
                                    <span className="text-foreground-subtle">Entry:</span>{" "}
                                    {message.action.data.entry_price}
                                  </div>
                                )}
                                {message.action.data.pnl != null && (
                                  <div>
                                    <span className="text-foreground-subtle">P&amp;L:</span>{" "}
                                    ${message.action.data.pnl}
                                  </div>
                                )}
                                {message.action.data.setup && (
                                  <div>
                                    <span className="text-foreground-subtle">Setup:</span>{" "}
                                    {message.action.data.setup}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    void handleConfirmTrade(
                                      message.id,
                                      (message.action as { data: ParsedTrade }).data,
                                    )
                                  }
                                >
                                  Confirm &amp; Log
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => handleDismissAction(message.id)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Task Action Confirmation Card */}
                          {message.action?.type === "task" && (
                            <div className="mt-2.5 border border-border/80 rounded-xl p-3 bg-surface-3/50 space-y-1.5 text-foreground">
                              <p className="text-xs font-bold text-brand flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Create Task
                              </p>
                              <div className="text-xs font-medium">{message.action.data.title}</div>
                              <div className="text-[10px] text-foreground-subtle">
                                Priority: {message.action.data.priority} · Category:{" "}
                                {message.action.data.category}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    void handleConfirmTask(
                                      message.id,
                                      (message.action as { data: ParsedTask }).data,
                                    )
                                  }
                                >
                                  Create Task
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => handleDismissAction(message.id)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          )}

                          {message.actionNote && (
                            <p className="mt-1.5 text-[11px] text-brand font-semibold">
                              ✓ {message.actionNote}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {message.timestamp && (
                      <span className="text-[9px] text-foreground-subtle px-1">
                        {message.timestamp}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Prompts Carousel (when 1 message or empty) */}
              {messages.length <= 1 && (
                <div className="px-4 py-2 border-t border-border/40 bg-surface/50">
                  <p className="text-[10px] font-bold text-foreground-subtle uppercase tracking-wider mb-1.5">
                    Quick Prompts
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((p, idx) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => void handleSend(p.text)}
                          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-border/70 bg-surface-2/80 text-foreground-muted hover:text-foreground hover:border-brand/40 hover:bg-brand/5 transition-all text-left"
                        >
                          <Icon className="w-3 h-3 text-brand shrink-0" />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-border/70 bg-surface-2/40">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={
                      mode === "agent"
                        ? "Ask Agent to audit trades, calculate risk, or inspect..."
                        : "Ask trading questions, psychology, or position sizing..."
                    }
                    disabled={sending || !conversationId}
                    className="flex-1 bg-surface border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-50 placeholder:text-foreground-subtle text-foreground shadow-xs"
                  />
                  <Button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending || !conversationId}
                    size="default"
                    className="h-9 px-3 rounded-xl"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
