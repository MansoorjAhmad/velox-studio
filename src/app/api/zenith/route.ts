import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, requestClientKey } from "@/lib/server/rate-limit";
import {
  executeAgentTool,
  type AgentStep,
} from "@/lib/zenith/agent-tools";

// Single model — Velox Zenith Intelligence Engine (gemini-3.5-flash-lite)
const MODEL_NAME = "gemini-3.5-flash-lite";

// Tool schema descriptions for the prompt-based dispatch
const TOOL_DESCRIPTIONS = `
You have access to these tools. To call a tool, output a line with EXACTLY this format (JSON on one line):
TOOL_CALL: {"tool": "<tool_name>", "args": {<args_json>}}

Available tools:
- get_trades: {"limit":number,"symbol":string,"session":string,"setup":string,"direction":string,"status":string}
- get_performance_metrics: {"symbol":string,"session":string,"setup":string}
- get_breakdowns: {"dimension":"setup"|"session"|"symbol"|"day_of_week"}
- get_trader_index: {}
- log_trade: {"symbol":string,"direction":"LONG"|"SHORT","entry_price":number,"stop_loss":number,"take_profit":number,"exit_price":number,"pnl":number,"setup":string,"session":string}
- create_task: {"title":string,"priority":"low"|"medium"|"high","category":string,"due_date":string}
- calculate_position_size: {"symbol":string,"risk_amount":number,"stop_loss_pips":number,"account_type":string}

Rules:
- When asked about real trade data, metrics, or discipline — call the appropriate tool first.
- Output TOOL_CALL on its own line, then wait for the TOOL_RESULT before continuing.
- After receiving TOOL_RESULT, synthesize a direct, professional response using the real data.
- For conversational messages (greetings, general questions), respond directly without calling tools.
`;

const AGENT_SYSTEM_INSTRUCTION = `You are Velox Zenith — an institutional AI trading copilot built into Velox Studio.
${TOOL_DESCRIPTIONS}
Be concise, direct, and institutional. Use trader terminology (R:R, expectancy, drawdown, confluences). Bullet points and bold metrics where useful.`;

const CHAT_SYSTEM_INSTRUCTION = `You are Velox Zenith — an AI trading assistant built into Velox Studio.
You help traders with position sizing, risk management, trade analysis, routine building, and trading psychology.
Be direct, knowledgeable, and professional. Use trader terminology. Be concise — traders want answers, not essays.`;

function parseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  const match = text.match(/TOOL_CALL:\s*(\{.+\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (typeof parsed.tool === "string") {
      return { tool: parsed.tool, args: (parsed.args ?? {}) as Record<string, unknown> };
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let user: { id: string; email?: string } | null = null;

  // 1. Check Bearer token from authorization header first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const { data: tokenData } = await supabase.auth.getUser(token);
      if (tokenData?.user) user = tokenData.user;
    }
  }

  // 2. Fall back to cookie-based session
  if (!user) {
    const { data: cookieData } = await supabase.auth.getUser();
    if (cookieData?.user) user = cookieData.user;
  }

  const userId = user?.id ?? "";
  const clientKey = userId ? `user:${userId}` : requestClientKey(req);

  if (isRateLimited(`zenith:${clientKey}`, 40, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured on the server." },
      { status: 500 },
    );
  }

  let body: {
    mode?: "chat" | "agent";
    userMessage?: unknown;
    systemPrompt?: unknown;
    conversationHistory?: Array<{ role: string; text: string }>;
    accountId?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.userMessage !== "string" ||
    !body.userMessage.trim() ||
    body.userMessage.length > 20_000
  ) {
    return NextResponse.json({ error: "Missing or invalid userMessage" }, { status: 400 });
  }

  const isAgentMode = body.mode === "agent";
  const genAI = new GoogleGenerativeAI(apiKey);

  // ────────────────────────────────────────────────────────────────
  //  AGENT MODE — Prompt-based tool dispatch (works with all models)
  // ────────────────────────────────────────────────────────────────
  if (isAgentMode) {
    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction:
          typeof body.systemPrompt === "string" && body.systemPrompt
            ? body.systemPrompt
            : AGENT_SYSTEM_INSTRUCTION,
        // No native tools — use prompt-based dispatch for compatibility
      });

      // Build conversation prompt from history
      let conversationContext = "";
      if (Array.isArray(body.conversationHistory)) {
        const recent = body.conversationHistory.slice(-8);
        if (recent.length > 0) {
          conversationContext =
            recent
              .map((h) => `${h.role === "user" ? "Trader" : "Zenith"}: ${h.text}`)
              .join("\n") + "\n\n";
        }
      }

      const fullPrompt = `${conversationContext}Trader: ${body.userMessage}`;

      const executedSteps: AgentStep[] = [];
      let currentPrompt = fullPrompt;
      let finalText = "";
      let turns = 0;

      // Agentic loop: model outputs TOOL_CALL → we execute → feed TOOL_RESULT back
      while (turns < 5) {
        const result = await model.generateContent(currentPrompt);
        const rawText = result.response.text();

        const toolCall = parseToolCall(rawText);

        if (!toolCall) {
          // No tool call — this is the final answer
          // Strip any stray TOOL_CALL lines from response
          finalText = rawText.replace(/TOOL_CALL:.*$/gm, "").trim();
          break;
        }

        turns++;

        // Execute the tool
        const toolResult = await executeAgentTool(
          toolCall.tool,
          toolCall.args,
          { supabase, userId, accountId: body.accountId },
        );

        executedSteps.push({
          tool: toolCall.tool,
          args: toolCall.args,
          summary: toolResult.summary,
          data: toolResult.data,
        });

        // Feed result back into the prompt for the next turn
        const resultJson = JSON.stringify(toolResult.data ?? {}, null, 2);
        currentPrompt =
          `${currentPrompt}\n\nZenith: ${rawText}\n\nTOOL_RESULT: ${resultJson}\n\nZenith: `;
      }

      // If we hit max turns without a final answer, ask for synthesis
      if (!finalText && turns >= 5) {
        const synthResult = await model.generateContent(
          `${currentPrompt}\n\nBased on all the data above, provide your final concise analysis to the trader.`,
        );
        finalText = synthResult.response.text();
      }

      return NextResponse.json({
        text: finalText || "Analysis complete.",
        steps: executedSteps,
      });
    } catch (err) {
      console.error("Zenith Agent error:", err);
      return NextResponse.json(
        { error: "Zenith Agent encountered an error. Please try again." },
        { status: 502 },
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  //  CHAT MODE (Direct Fast Single-Shot Response)
  // ────────────────────────────────────────────────────────────────
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction:
        typeof body.systemPrompt === "string" && body.systemPrompt
          ? body.systemPrompt
          : CHAT_SYSTEM_INSTRUCTION,
    });

    let prompt = body.userMessage;
    if (Array.isArray(body.conversationHistory) && body.conversationHistory.length > 0) {
      const historyText = body.conversationHistory
        .slice(-8)
        .map((h) => `${h.role === "user" ? "User" : "Zenith"}: ${h.text}`)
        .join("\n");
      prompt = `Recent conversation:\n${historyText}\n\nUser: ${body.userMessage}`;
    }

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text(), steps: [] });
  } catch (err) {
    console.error("Zenith Chat error:", err);
    return NextResponse.json(
      { error: "Zenith Chat encountered an error. Please try again." },
      { status: 502 },
    );
  }
}

