import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { DemoCreditPurchase } from "@/components/credits/DemoCreditPurchase";
import { CreditPurchase } from "@/components/credits/CreditPurchase";
import { appConfig, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { getBalance } from "@/lib/credits";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-cookie";
import { loadDemoCreditActivity, loadDemoSession } from "@/lib/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { CreditTransaction } from "@/types";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  let balance = 10;
  let transactions: CreditTransaction[] = [];
  let isDemo = false;

  if (hasSupabaseEnv() && hasSupabaseAdminEnv()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    balance = await getBalance(user.id);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("credit_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    transactions = (data || []) as CreditTransaction[];
  } else {
    isDemo = true;
    const demoSessionId = cookies().get(DEMO_SESSION_COOKIE)?.value || "shared-demo";
    const demoSession = await loadDemoSession(demoSessionId);
    balance = demoSession.credits;
    transactions = await loadDemoCreditActivity(demoSessionId);
  }

  return (
    <main className="min-h-screen bg-blackwolf px-4 py-6 text-text md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/chat" className="font-heading text-lg font-semibold text-gold">
            Venture Wolf
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href="/assets" className="border border-white/10 px-3 py-2 text-muted hover:text-text">
              Assets
            </Link>
            {!isDemo && (
              <form action={logoutAction}>
                <button className="border border-white/10 px-3 py-2 text-muted hover:text-text">Logout</button>
              </form>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_360px]">
          <section>
            <div className="mb-5 border border-gold/25 bg-gold/10 p-6">
              <div className="text-sm text-muted">Current balance</div>
              <div className="mt-2 font-heading text-5xl font-semibold text-gold">{balance}</div>
              <div className="mt-1 text-sm text-muted">credits available</div>
            </div>

            <div className="border border-white/10 bg-card">
              <div className="border-b border-white/10 px-5 py-4 font-heading font-semibold">
                Credit activity
              </div>
              {transactions.length === 0 ? (
                <div className="p-5 text-sm text-muted">No transactions yet.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between px-5 py-4 text-sm">
                      <div>
                        <div>{transaction.reason || transaction.type}</div>
                        <div className="text-xs text-muted">{formatDate(transaction.created_at)}</div>
                      </div>
                      <div className={transaction.amount > 0 ? "text-green" : "text-red"}>
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside>
            {isDemo ? (
              <DemoCreditPurchase />
            ) : (
              <CreditPurchase
                minCredits={appConfig.minCreditPurchase}
                creditPricePaise={appConfig.creditPricePaise}
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
