import { appConfig, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { createRazorpay } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return Response.json({ error: "Supabase env vars are required." }, { status: 500 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { credits?: number };
  const credits = Math.floor(Number(body.credits || 0));
  if (credits < appConfig.minCreditPurchase) {
    return Response.json(
      { error: `Minimum purchase is ${appConfig.minCreditPurchase} credits.` },
      { status: 400 },
    );
  }

  const amount = credits * appConfig.creditPricePaise;
  const razorpay = createRazorpay();
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `vw_${user.id.slice(0, 8)}_${Date.now()}`,
  });

  const admin = createAdminClient();
  const { error } = await admin.from("payment_orders").insert({
    user_id: user.id,
    razorpay_order_id: order.id,
    credits,
    amount_paise: amount,
    status: "created",
  });

  if (error) throw error;

  return Response.json({
    orderId: order.id,
    amount,
    currency: "INR",
    keyId: appConfig.publicRazorpayKeyId,
  });
}
