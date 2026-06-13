import { X_STORM_SUPABASE_URL } from "@/lib/constants";

export const appConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || X_STORM_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  openAiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o",
  demoFallback: process.env.X_STORM_DEMO_FALLBACK === "true",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  publicRazorpayKeyId:
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  devangEmail: (process.env.DEVANG_EMAIL || "devang@venturewolf.in").toLowerCase(),
  freeCreditsOnSignup: Number(process.env.FREE_CREDITS_ON_SIGNUP || 10),
  minCreditPurchase: Number(process.env.MIN_CREDIT_PURCHASE || 100),
  creditPricePaise: Number(process.env.CREDIT_PRICE_PAISE || 1000),
};

export function hasSupabaseEnv() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

export function hasSupabaseAdminEnv() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseServiceRoleKey);
}
