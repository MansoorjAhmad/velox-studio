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
}

const welcomeMessage = (mode: "agent" | "chat"): Message => ({
  id: "welcome",
  role: "agent",
  text:
    mode === "agent"
      ? "Institutional Agent online. I can execute live queries on your trades, audit performance metrics, calculate lot sizing, or log trades and tasks directly. What would you like to inspect?"
      : "Trading Copilot online. Ask me anything about risk management, ICT/SMC concepts, psychology, or position sizing formulas. How can I help?",
});

const QUICK_CHIPS = [
  "Audit my win rate on XAUUSD",
  "What is my biggest loss this week?",
  "Calculate lot size for $300 risk on Gold (20 pips SL)",
  "How is my Trader Index score?",
  "Create task: Review NY session trades",
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
      setTimeout(() => inputRef.current?.focus(), 100);
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
    updateMessage(id, { action: undefined, actionNote: `Couldn't save: ${error}` });
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
      notes: "Logged by Zenith Agent",
      status: data.exit_price != null ? "closed" : "open",
      account_id: getActiveAccountId() === "all" ? null : getActiveAccountId(),
    });
    if (result.error) handleActionError(id, result.error);
    else handleActionConfirmed(id, "Trade logged successfully.");
  };

  const handleConfirmTask = async (id: string, data: ParsedTask) => {
    const result = await createTask({
      title: data.title,
      priority: data.priority,
      category: data.category,
      due_date: data.due_date,
    });
    if (result.error) handleActionError(id, result.error);
    else handleActionConfirmed(id, "Task created successfully.");
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending || !conversationId) return;
      setInput("");
      setSending(true);

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
      setMessages((current) => [...current, userMsg]);
      void saveMessageToConversation(conversationId, "user", text);

      const loadingId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        { id: loadingId, role: "agent", text: "", loading: true },
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/25 hover:scale-105 active:scale-95 transition-all md:bottom-6 md:right-6 group"
        title="Zenith Agent"
      >
        <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-out",
        minimized
          ? "bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14"
          : isExpanded
            ? "bottom-4 right-4 md:bottom-6 md:right-6 w-[calc(100vw-2rem)] max-w-[740px] h-[min(700px,calc(100svh-4rem))]"
            : "bottom-20 right-4 md:bottom-6 md:right-6 w-[calc(100vw-2rem)] max-w-[420px] h-[min(560px,calc(100svh-7rem))]",
      )}
    >
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          className="w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg hover:scale-105 transition-all"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </button>
      ) : (
        <div className="flex flex-col h-full rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-surface-2/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold tracking-tight">Zenith Agent</p>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand/15 text-brand border border-brand/20">
                    2.0
                  </span>
                </div>
                <p className="text-[10px] text-foreground-subtle">Institutional Trading Copilot</p>
              </div>
            </div>

            {/* Mode toggle and actions */}
            <div className="flex items-center gap-1.5">
              {/* Mode switch */}
              <div className="flex items-center p-0.5 rounded-lg bg-surface-3/60 border border-border/60 text-xs">
                <button
                  onClick={() => setMode("agent")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md transition-all text-[11px] font-medium",
                    mode === "agent"
                      ? "bg-brand text-white shadow-xs font-semibold"
                      : "text-foreground-subtle hover:text-foreground",
                  )}
                  title="Agent Mode: multi-step reasoning with live database tool execution"
                >
                  <Zap className="w-3 h-3" />
                  Agent
                </button>
                <button
                  onClick={() => setMode("chat")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md transition-all text-[11px] font-medium",
                    mode === "chat"
                      ? "bg-brand text-white shadow-xs font-semibold"
                      : "text-foreground-subtle hover:text-foreground",
                  )}
                  title="Chat Mode: fast conversational trading questions and coaching"
                >
                  <MessageSquare className="w-3 h-3" />
                  Chat
                </button>
              </div>

              {/* Utility controls */}
              <button
                onClick={() => {
                  void refreshConversations();
                  setView(view === "chat" ? "history" : "chat");
                }}
                className="p-1.5 rounded-md hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Chat history"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => void startNewChat()}
                className="p-1.5 rounded-md hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="New chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-md hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors hidden sm:inline-flex"
                title={isExpanded ? "Collapse view" : "Expand terminal"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="p-1.5 rounded-md hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-surface-3 text-foreground-subtle hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
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
                    className="flex items-center gap-1 rounded-lg border border-border/40 hover:bg-surface-2 transition-colors"
                  >
                    <button
                      className="flex-1 min-w-0 text-left px-3 py-2.5"
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
              {/* Messages area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col space-y-1.5",
                      message.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {/* Tool steps reasoning badges (if agent executed tools) */}
                    {message.role === "agent" && message.steps && message.steps.length > 0 && (
                      <div className="space-y-1 mb-1 max-w-[95%]">
                        {message.steps.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand/10 border border-brand/20 text-[11px] text-foreground"
                          >
                            <Wrench className="w-3 h-3 text-brand shrink-0" />
                            <span className="font-mono text-brand font-semibold">{step.tool}</span>
                            <span className="text-foreground-subtle truncate">→ {step.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chat bubble */}
                    <div
                      className={cn(
                        "max-w-[90%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs",
                        message.role === "user"
                          ? "bg-brand text-white rounded-br-xs"
                          : "bg-surface-2 border border-border/60 text-foreground rounded-bl-xs",
                      )}
                    >
                      {message.loading ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                          <span className="text-foreground-subtle text-xs">
                            {mode === "agent" ? "Executing tools & reasoning…" : "Thinking…"}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap">{message.text}</div>

                          {/* Trade action confirmation */}
                          {message.action?.type === "trade" && (
                            <div className="mt-3 border border-border/80 rounded-xl p-3 bg-surface-3/40 space-y-2 text-foreground">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-brand flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Log Trade
                                </p>
                                <span className="text-[10px] text-foreground-subtle font-mono">
                                  {message.action.data.direction}
                                </span>
                              </div>
                              <div className="text-[12px] font-mono grid grid-cols-2 gap-1 py-1">
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
                                    <span className="text-foreground-subtle">P&L:</span>{" "}
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
                                  onClick={() => handleDismissAction(message.id)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Task action confirmation */}
                          {message.action?.type === "task" && (
                            <div className="mt-3 border border-border/80 rounded-xl p-3 bg-surface-3/40 space-y-2 text-foreground">
                              <p className="text-xs font-semibold text-brand flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Create Task
                              </p>
                              <div className="text-[12px]">
                                <strong>{message.action.data.title}</strong>
                                <div className="text-[11px] text-foreground-subtle mt-0.5">
                                  Priority: {message.action.data.priority} · Category:{" "}
                                  {message.action.data.category}
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
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
                                  onClick={() => handleDismissAction(message.id)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          )}

                          {message.actionNote && (
                            <p className="mt-2 text-xs text-brand font-medium">
                              ✓ {message.actionNote}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick prompt chips (shown when 1 message or empty) */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2">
                  <p className="text-[10px] font-semibold text-foreground-subtle uppercase tracking-wider mb-1.5">
                    Quick Forensic Prompts
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CHIPS.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => void handleSend(chip)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-surface-2/70 text-foreground-muted hover:text-foreground hover:border-brand/40 hover:bg-brand/5 transition-all text-left truncate max-w-full"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input bar */}
              <div className="border-t border-border/80 p-3 bg-surface-2/30">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={
                      mode === "agent"
                        ? "Ask Agent to inspect trades, calculate risk, or audit..."
                        : "Ask trading questions, psychology, or position sizing..."
                    }
                    disabled={sending || !conversationId}
                    className="flex-1 bg-surface-2 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-50 placeholder:text-foreground-subtle text-foreground"
                  />
                  <Button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending || !conversationId}
                    size="default"
                    className="h-10 px-3.5"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
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
