import { cookies } from "next/headers";
import { CREDIT_COSTS } from "@/lib/constants";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import {
  createInvestorMemoBuffer,
  extractFounderDataFromMessages,
  extractFounderData,
  uploadAssetFile,
} from "@/lib/assets";
import { deductCredits, getBalance } from "@/lib/credits";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-cookie";
import { loadDemoSession, saveDemoAsset } from "@/lib/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    const demoSessionId = cookies().get(DEMO_SESSION_COOKIE)?.value || "shared-demo";
    const demoSession = await loadDemoSession(demoSessionId);
    if (demoSession.credits < CREDIT_COSTS.INVESTOR_MEMO) {
      return Response.json({ error: "Insufficient credits." }, { status: 402 });
    }

    const data = await extractFounderDataFromMessages(demoSession.messages);
    const buffer = await createInvestorMemoBuffer(data);
    const saved = await saveDemoAsset({
      sessionId: demoSessionId,
      type: "investor_memo",
      buffer,
      extension: "pdf",
      contentType: "application/pdf",
      data: data as unknown as Record<string, unknown>,
      creditsUsed: CREDIT_COSTS.INVESTOR_MEMO,
    });

    return Response.json({
      assetId: saved.asset.id,
      downloadUrl: saved.downloadUrl,
      credits: saved.credits,
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const balance = await getBalance(user.id);
  if (balance < CREDIT_COSTS.INVESTOR_MEMO) {
    return Response.json({ error: "Insufficient credits." }, { status: 402 });
  }

  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: asset, error: assetError } = await admin
    .from("assets")
    .insert({
      user_id: user.id,
      conversation_id: conversation?.id ?? null,
      type: "investor_memo",
      status: "generating",
      credits_used: CREDIT_COSTS.INVESTOR_MEMO,
    })
    .select("id")
    .single();

  if (assetError) throw assetError;

  try {
    const credits = await deductCredits(
      user.id,
      CREDIT_COSTS.INVESTOR_MEMO,
      "Investor memo",
      asset.id,
    );
    const data = await extractFounderData(user.id);
    const buffer = await createInvestorMemoBuffer(data);
    const upload = await uploadAssetFile({
      userId: user.id,
      assetId: asset.id,
      type: "investor_memo",
      buffer,
      extension: "pdf",
      contentType: "application/pdf",
    });

    await admin
      .from("assets")
      .update({ status: "ready", file_url: upload.path, data })
      .eq("id", asset.id);

    return Response.json({ assetId: asset.id, downloadUrl: upload.signedUrl, credits });
  } catch (error) {
    await admin.from("assets").update({ status: "failed" }).eq("id", asset.id);
    return Response.json(
      { error: error instanceof Error ? error.message : "Investor memo generation failed." },
      { status: 500 },
    );
  }
}
