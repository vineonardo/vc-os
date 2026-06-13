import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { appConfig } from "@/lib/config";

export function createClient() {
  if (!appConfig.supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for Supabase server access.");
  }

  const cookieStore = cookies();

  return createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refreshes the session.
        }
      },
    },
  });
}
