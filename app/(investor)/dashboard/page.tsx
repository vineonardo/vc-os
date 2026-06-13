import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { ScorePill } from "@/components/dashboard/ScorePill";
import { appConfig, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { FounderPipelineRow, ReadinessLabel } from "@/types";

export const dynamic = "force-dynamic";

const demoRows: FounderPipelineRow[] = [
  {
    id: "1",
    email: "aarav@example.com",
    full_name: "Aarav Shah",
    company_name: "Logistics SaaS",
    sector: "B2B SaaS",
    stage: "Rs 1.2L MRR",
    score: 84,
    label: "Most Promising",
    assets_ready: 3,
    last_activity: new Date().toISOString(),
  },
  {
    id: "2",
    email: "priya@example.com",
    full_name: "Priya Mehta",
    company_name: "D2C Beauty",
    sector: "D2C",
    stage: "10K orders/mo",
    score: 63,
    label: "High Potential",
    assets_ready: 2,
    last_activity: new Date().toISOString(),
  },
];

export default async function DashboardPage() {
  let rows = demoRows;

  if (hasSupabaseEnv() && hasSupabaseAdminEnv()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const email = (user.email || "").toLowerCase();
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "investor" && email !== appConfig.devangEmail) redirect("/chat");

    const { data, error } = await admin
      .from("profiles")
      .select(
        "id,email,full_name,company_name,sector,stage,readiness_scores(score,label),assets(id,status),conversations(updated_at)",
      )
      .eq("role", "founder");

    if (error) throw error;

    rows = (data || []).map((row) => {
      const score = Array.isArray(row.readiness_scores)
        ? row.readiness_scores[0]
        : row.readiness_scores;
      const conversations = Array.isArray(row.conversations) ? row.conversations : [];
      const last = conversations
        .map((conversation) => conversation.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1);

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        company_name: row.company_name,
        sector: row.sector,
        stage: row.stage,
        score: score?.score ?? null,
        label: (score?.label as ReadinessLabel | null) ?? null,
        assets_ready: Array.isArray(row.assets)
          ? row.assets.filter((asset) => asset.status === "ready").length
          : 0,
        last_activity: last || null,
      };
    });
  }

  const reviewReady = rows.filter((row) => (row.score || 0) >= 60).length;

  return (
    <main className="min-h-screen bg-blackwolf px-4 py-6 text-text md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="font-heading text-xl font-semibold text-gold">Venture Wolf</div>
            <div className="text-sm text-muted">Investor View • Devang Raja</div>
          </div>
          <form action={logoutAction}>
            <button className="border border-white/10 px-3 py-2 text-sm text-muted hover:text-text">
              Logout
            </button>
          </form>
        </div>

        <section className="mb-5 grid gap-3 md:grid-cols-3">
          <Metric label="New this week" value={rows.length} />
          <Metric label="Review-ready" value={reviewReady} />
          <Metric label="In preparation" value={Math.max(0, rows.length - reviewReady)} />
        </section>

        <section className="border border-white/10 bg-card">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr] border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-muted">
            <div>Founder</div>
            <div>Sector</div>
            <div>Signal</div>
            <div>Assets</div>
            <div>Activity</div>
          </div>
          <div className="divide-y divide-white/10">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr] md:items-center"
              >
                <div>
                  <div className="font-heading font-semibold">{row.full_name || row.email}</div>
                  <div className="text-xs text-muted">
                    {row.company_name || "Company not captured"} • {row.stage || "Stage missing"}
                  </div>
                </div>
                <div className="text-muted">{row.sector || "Uncategorized"}</div>
                <ScorePill score={row.score} label={row.label} />
                <div className="text-muted">{row.assets_ready} ready</div>
                <div className="text-xs text-muted">{formatDate(row.last_activity)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 font-heading text-4xl font-semibold text-gold">{value}</div>
    </div>
  );
}
