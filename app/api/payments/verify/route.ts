import { addCredits, getBalance } from "@/lib/credits";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { verifyRazorpaySignature } from "@/lib/razorpay";
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

  const body = (await request.json().catch(() => ({}))) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return Response.json({ error: "Missing payment verification fields." }, { status: 400 });
  }

  if (
    !verifyRazorpaySignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    })
  ) {
    return Response.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("payment_orders")
    .select("*")
    .eq("razorpay_order_id", body.razorpay_order_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return Response.json({ error: "Payment order not found." }, { status: 404 });

  if (order.status === "paid") {
    return Response.json({ balance: await getBalance(user.id) });
  }

  await admin
    .from("payment_orders")
    .update({
      status: "paid",
      razorpay_payment_id: body.razorpay_payment_id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  const balance = await addCredits(
    user.id,
    order.credits,
    "purchase",
    "Razorpay credit purchase",
    body.razorpay_payment_id,
  );

  return Response.json({ balance });
}
