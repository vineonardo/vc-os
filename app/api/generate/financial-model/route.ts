import { CREDIT_COSTS } from "@/lib/constants";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import {
  createFinancialModelBuffer,
  extractFounderData,
  uploadAssetFile,
} from "@/lib/assets";
import { deductCredits, getBalance } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return Response.json({ error: "Supabase env vars are required." }, { status: 500 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const balance = await getBalance(user.id);
  if (balance < CREDIT_COSTS.FINANCIAL_MODEL) {
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
      type: "financial_model",
      status: "generating",
      credits_used: CREDIT_COSTS.FINANCIAL_MODEL,
    })
    .select("id")
    .single();

  if (assetError) throw assetError;

  try {
    const credits = await deductCredits(
      user.id,
      CREDIT_COSTS.FINANCIAL_MODEL,
      "Financial model",
      asset.id,
    );
    const data = await extractFounderData(user.id);
    const buffer = await createFinancialModelBuffer(data);
    const upload = await uploadAssetFile({
      userId: user.id,
      assetId: asset.id,
      type: "financial_model",
      buffer,
      extension: "xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await admin
      .from("assets")
      .update({ status: "ready", file_url: upload.path, data })
      .eq("id", asset.id);

    return Response.json({ assetId: asset.id, downloadUrl: upload.signedUrl, credits });
  } catch (error) {
    await admin.from("assets").update({ status: "failed" }).eq("id", asset.id);
    return Response.json(
      { error: error instanceof Error ? error.message : "Financial model generation failed." },
      { status: 500 },
    );
  }
}
