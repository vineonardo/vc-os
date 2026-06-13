import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/config";
import type { CreditTransactionType } from "@/types";

export async function getBalance(userId: string): Promise<number> {
  if (!hasSupabaseAdminEnv()) return 10;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.balance ?? 0;
}

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
): Promise<number> {
  if (!hasSupabaseAdminEnv()) return Math.max(0, 10 - amount);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });

  if (error) throw error;
  return Number(data);
}

export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  reason: string,
  refId?: string,
): Promise<number> {
  if (!hasSupabaseAdminEnv()) return amount;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });

  if (error) throw error;
  return Number(data);
}
