import { createBrowserClient } from "@supabase/ssr";
import { appConfig } from "@/lib/config";

export function createClient() {
  if (!appConfig.supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for Supabase browser access.");
  }

  return createBrowserClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
}
