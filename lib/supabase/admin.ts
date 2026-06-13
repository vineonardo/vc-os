import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export function createAdminClient() {
  if (!appConfig.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.");
  }

  return createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
