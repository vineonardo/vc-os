import { CREDIT_COSTS } from "@/lib/constants";
import { createOpenAI, getOpenAIModel } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCORING_PROMPT } from "@/lib/wolf";
import { readinessLabel } from "@/lib/utils";

type ScorePayload = {
  total: number;
  label: string;
  breakdown: Record<string, number>;
};

function normalizeScore(payload: Partial<ScorePayload>): ScorePayload {
  const breakdown = payload.breakdown || {};
  const total = Math.max(0, Math.min(100, Math.round(Number(payload.total || 0))));
  return {
    total,
    label: readinessLabel(total),
    breakdown: {
      problem_clarity: Number(breakdown.problem_clarity || 0),
      solution_differentiation: Number(breakdown.solution_differentiation || 0),
      traction_strength: Number(breakdown.traction_strength || 0),
      team_quality: Number(breakdown.team_quality || 0),
      market_size_credibility: Number(breakdown.market_size_credibility || 0),
    },
  };
}

export async function generateReadinessScore(userId: string) {
  const supabase = createAdminClient();
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId);

  if (conversationError) throw conversationError;
  const conversationIds = (conversations || []).map((row) => row.id);
  if (conversationIds.length === 0) throw new Error("No conversation found for scoring.");

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });

  if (messageError) throw messageError;

  const transcript = (messages || [])
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const openai = createOpenAI();
  const completion = await openai.chat.completions.create({
    model: getOpenAIModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SCORING_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  const parsed = normalizeScore(
    JSON.parse(completion.choices[0]?.message.content || "{}") as Partial<ScorePayload>,
  );

  const { data, error } = await supabase
    .from("readiness_scores")
    .upsert(
      {
        user_id: userId,
        score: parsed.total,
        label: parsed.label,
        breakdown: parsed.breakdown,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function maybeTriggerScore(userId: string, messageCount: number) {
  if (messageCount < 10) return;

  try {
    await generateReadinessScore(userId);
  } catch (error) {
    console.error("Readiness score generation failed", error);
  }
}

export function chatCreditCost() {
  return CREDIT_COSTS.CHAT_MESSAGE;
}
