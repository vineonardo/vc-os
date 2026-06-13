import { appConfig, hasSupabaseAdminEnv } from "@/lib/config";
import { addCredits } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

export async function ensureProfile(user: User, fullName?: string) {
  if (!hasSupabaseAdminEnv()) return null;

  const supabase = createAdminClient();
  const email = (user.email || "").toLowerCase();
  const role = email === appConfig.devangEmail ? "investor" : "founder";

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        full_name: fullName || user.user_metadata?.full_name || null,
        role,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) throw error;

  if (!existing && role === "founder") {
    await addCredits(user.id, appConfig.freeCreditsOnSignup, "grant", "Signup bonus");
  }

  return data;
}
