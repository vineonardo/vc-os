import { cookies } from "next/headers";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-cookie";
import { addDemoCredits } from "@/lib/demo-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (hasSupabaseEnv() && hasSupabaseAdminEnv()) {
    return Response.json({ error: "Demo credit top-up is unavailable for signed-in accounts." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { credits?: number };
  const credits = Math.floor(Number(body.credits || 0));
  if (![100, 250, 500].includes(credits)) {
    return Response.json({ error: "Choose 100, 250, or 500 credits." }, { status: 400 });
  }

  const demoSessionId = cookies().get(DEMO_SESSION_COOKIE)?.value || "shared-demo";
  const session = await addDemoCredits(demoSessionId, credits);

  return Response.json({ balance: session.credits });
}
