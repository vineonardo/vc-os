import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { generateReadinessScore } from "@/lib/score";
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

  const score = await generateReadinessScore(user.id);
  return Response.json({ score });
}
