import { NextRequest } from "next/server";
import { CREDIT_COSTS } from "@/lib/constants";
import { appConfig, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { deductCredits, getBalance } from "@/lib/credits";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-cookie";
import { appendDemoExchange, loadDemoSession } from "@/lib/demo-store";
import { createOpenAI, getOpenAIModel } from "@/lib/openai";
import { maybeTriggerScore } from "@/lib/score";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WOLF_SYSTEM_PROMPT } from "@/lib/wolf";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function sse(payload: unknown, event?: string) {
  const prefix = event ? `event: ${event}\n` : "";
  return encoder.encode(`${prefix}data: ${JSON.stringify(payload)}\n\n`);
}

function fallbackWolfReply(message: string) {
  const topic = message.length > 120 ? `${message.slice(0, 117)}...` : message;
  return `Good start. I have this: ${topic}\n\nNow give me the numbers behind it. How many paying customers do you have, what is current monthly revenue, and what is the month-on-month growth rate?`;
}

function safeChatError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("api key") || message.includes("401")) {
    return "Wolf could not reach OpenAI. Check the OPENAI_API_KEY configured for this app.";
  }

  return "Wolf could not respond. Please try again.";
}

async function streamWolfResponse({
  userId,
  conversationId,
  message,
  history,
  persist,
}: {
  userId: string;
  conversationId: string | null;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  persist: (assistantContent: string) => Promise<number>;
}) {
  return new ReadableStream({
    async start(controller) {
      let assistantContent = "";

      try {
        if (appConfig.demoFallback) {
          assistantContent = fallbackWolfReply(message);
          for (const token of assistantContent.split(/(\s+)/)) {
            controller.enqueue(sse({ delta: token }));
          }
          const credits = await persist(assistantContent);
          controller.enqueue(sse({ credits, userId, conversationId }, "done"));
          return;
        }

        const openai = createOpenAI();
        const stream = await openai.chat.completions.create({
          model: getOpenAIModel(),
          stream: true,
          messages: [
            { role: "system", content: WOLF_SYSTEM_PROMPT },
            ...history,
            { role: "user", content: message },
          ],
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (!delta) continue;
          assistantContent += delta;
          controller.enqueue(sse({ delta }));
        }

        const credits = await persist(assistantContent);
        controller.enqueue(sse({ credits, userId, conversationId }, "done"));
      } catch (error) {
        console.error("Wolf chat failed", safeChatError(error));
        controller.enqueue(sse({ error: safeChatError(error) }, "error"));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    conversationId?: string | null;
  };
  const message = String(body.message || "").trim();
  if (!message) return Response.json({ error: "Message is required." }, { status: 400 });

  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    const demoSessionId = request.cookies.get(DEMO_SESSION_COOKIE)?.value || "shared-demo";
    const demoSession = await loadDemoSession(demoSessionId);
    if (demoSession.credits < CREDIT_COSTS.CHAT_MESSAGE) {
      return Response.json({ error: "Insufficient credits." }, { status: 402 });
    }

    const stream = await streamWolfResponse({
      userId: "demo",
      conversationId: demoSession.conversationId,
      message,
      history: demoSession.messages
        .slice(-20)
        .map((row) => ({ role: row.role as "user" | "assistant", content: row.content })),
      persist: async (assistantContent) => {
        const next = await appendDemoExchange(demoSessionId, message, assistantContent);
        return next.credits;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const balance = await getBalance(user.id);
  if (balance < CREDIT_COSTS.CHAT_MESSAGE) {
    return Response.json({ error: "Insufficient credits." }, { status: 402 });
  }

  const admin = createAdminClient();
  let conversationId = body.conversationId || null;

  if (conversationId) {
    const { data, error } = await admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) conversationId = null;
  }

  if (!conversationId) {
    const created = await admin
      .from("conversations")
      .insert({ user_id: user.id, title: "Founder screening" })
      .select("id")
      .single();
    if (created.error) throw created.error;
    conversationId = created.data.id;
  }

  const { data: historyRows, error: historyError } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (historyError) throw historyError;

  const history = (historyRows || [])
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));

  const stream = await streamWolfResponse({
    userId: user.id,
    conversationId,
    message,
    history,
    persist: async (assistantContent) => {
      await admin.from("messages").insert([
        { conversation_id: conversationId, role: "user", content: message, credits_used: 0 },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: assistantContent,
          credits_used: CREDIT_COSTS.CHAT_MESSAGE,
        },
      ]);

      const newBalance = await deductCredits(
        user.id,
        CREDIT_COSTS.CHAT_MESSAGE,
        "Wolf chat reply",
        conversationId ?? undefined,
      );

      await admin
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);
      await maybeTriggerScore(user.id, count || 0);

      return newBalance;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
