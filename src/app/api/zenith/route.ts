import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, requestClientKey } from "@/lib/server/rate-limit";
import {
  ZENITH_TOOL_DECLARATIONS,
  executeAgentTool,
  type AgentStep,
} from "@/lib/zenith/agent-tools";

const AGENT_SYSTEM_INSTRUCTION = `You are Velox Zenith Agent — an institutional AI trading copilot and analytical engine built into Velox Studio.
You have access to tools that query the trader's actual journal, metrics, trader index (discipline score), tasks, and can log trades or create tasks.

Guidelines:
- ALWAYS check real data using tools when asked about performance, trades, win rate, setups, discipline, or tasks. Never guess or hallucinate trade statistics.
- If the trader asks about their metrics, win rate, profit factor, or drawdown, call get_performance_metrics.
- If the trader asks about specific trades, recent trades, or symbol performance, call get_trades or get_breakdowns.
- If the trader asks about their discipline, psychology, revenge trading, or rule violations, call get_trader_index.
- If the trader describes a trade they just took or asks to log it, call log_trade.
- If the trader asks to create a task, reminder, or homework, call create_task.
- If the trader asks for lot size, risk sizing, or contract calculation, call calculate_position_size.
- Be concise, direct, and institutional. Use professional trader terminology (R:R, expectancy, drawdown, session confluences).
- Keep text crisp and readable with bullet points and bold metrics where helpful.`;

const CHAT_SYSTEM_INSTRUCTION = `You are Velox Zenith Agent — an AI trading assistant built into Velox Studio.
You help traders with position sizing, risk management, trade analysis, routine building, and trading psychology.
Be direct, knowledgeable, and professional. Use trader terminology. Be concise — traders want answers, not essays.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isRateLimited(`zenith:${user.id}:${requestClientKey(req)}`, 30, 60_000)) {
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

  // Model fallback list
  const models = isAgentMode
    ? ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    : ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

  // ────────────────────────────────────────────────────────────────
  //  AGENT MODE (Multi-turn Tool Calling Execution)
  // ────────────────────────────────────────────────────────────────
  if (isAgentMode) {
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction:
            typeof body.systemPrompt === "string" && body.systemPrompt
              ? body.systemPrompt
              : AGENT_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: ZENITH_TOOL_DECLARATIONS }],
        });

        // Format history for Gemini chat
        const history: Content[] = [];
        if (Array.isArray(body.conversationHistory)) {
          for (const item of body.conversationHistory.slice(-10)) {
            if (!item.text?.trim()) continue;
            history.push({
              role: item.role === "user" ? "user" : "model",
              parts: [{ text: item.text }],
            });
          }
        }

        const chat = model.startChat({ history });
        let response = await chat.sendMessage(body.userMessage);

        const executedSteps: AgentStep[] = [];
        let turns = 0;

        while (turns < 5) {
          const functionCalls = response.response.functionCalls();
          if (!functionCalls || functionCalls.length === 0) {
            break;
          }

          turns++;
          const functionResponseParts = [];

          for (const call of functionCalls) {
            const result = await executeAgentTool(
              call.name,
              (call.args ?? {}) as Record<string, unknown>,
              {
                supabase,
                userId: user.id,
                accountId: body.accountId,
              },
            );

            executedSteps.push({
              tool: call.name,
              args: (call.args ?? {}) as Record<string, unknown>,
              summary: result.summary,
              data: result.data,
            });

            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: result.data,
              },
            });
          }

          response = await chat.sendMessage(functionResponseParts);
        }

        const textResponse = response.response.text();
        return NextResponse.json({
          text: textResponse,
          steps: executedSteps,
        });
      } catch (err) {
        console.error(`Gemini agent error with model ${modelName}:`, err);
        continue;
      }
    }

    return NextResponse.json(
      { error: "Zenith Agent engine currently unavailable across all models." },
      { status: 502 },
    );
  }

  // ────────────────────────────────────────────────────────────────
  //  CHAT MODE (Direct Fast Single-Shot Stream/Response)
  // ────────────────────────────────────────────────────────────────
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
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
      console.error(`Gemini chat error with model ${modelName}:`, err);
      continue;
    }
  }

  return NextResponse.json({ error: "All Gemini models failed." }, { status: 502 });
}
