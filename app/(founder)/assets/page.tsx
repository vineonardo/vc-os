import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Asset, AssetType } from "@/types";

export const dynamic = "force-dynamic";

const iconByType: Record<AssetType, typeof Presentation> = {
  pitch_deck: Presentation,
  financial_model: FileSpreadsheet,
  investor_memo: FileText,
};

const labelByType: Record<AssetType, string> = {
  pitch_deck: "Pitch Deck",
  financial_model: "Financial Model",
  investor_memo: "Investor Memo",
};

export default async function AssetsPage() {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return <AssetsShell assets={[]} links={{}} />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const links: Record<string, string> = {};
  for (const asset of data || []) {
    if (asset.file_url) {
      const signed = await admin.storage.from("assets").createSignedUrl(asset.file_url, 60 * 60);
      if (!signed.error) links[asset.id] = signed.data.signedUrl;
    }
  }

  return <AssetsShell assets={(data || []) as Asset[]} links={links} />;
}

function AssetsShell({ assets, links }: { assets: Asset[]; links: Record<string, string> }) {
  return (
    <main className="min-h-screen bg-blackwolf px-4 py-6 text-text md:px-8">
      <div className="mx-auto max-w-6xl">
        <TopNav />
        <div className="mb-7">
          <h1 className="font-heading text-3xl font-semibold">Generated Assets</h1>
          <p className="mt-2 text-sm text-muted">
            Pitch decks, financial models, and investor memos prepared by Wolf.
          </p>
        </div>

        {assets.length === 0 ? (
          <div className="border border-white/10 bg-card p-6 text-sm text-muted">
            No generated assets yet. Continue the Wolf conversation and generate an output when ready.
          </div>
        ) : (
          <div className="grid gap-3">
            {assets.map((asset) => {
              const Icon = iconByType[asset.type];
              return (
                <div
                  key={asset.id}
                  className="flex flex-col gap-4 border border-white/10 bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center border border-gold/30 bg-gold/10 text-gold">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-heading font-semibold">{labelByType[asset.type]}</div>
                      <div className="text-xs text-muted">
                        {asset.status} • {asset.credits_used} credits • {formatDate(asset.created_at)}
                      </div>
                    </div>
                  </div>
                  {links[asset.id] && (
                    <a
                      href={links[asset.id]}
                      className="inline-flex h-10 items-center justify-center gap-2 bg-gold px-4 text-sm font-semibold text-blackwolf"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function TopNav() {
  return (
    <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
      <Link href="/chat" className="font-heading text-lg font-semibold text-gold">
        Venture Wolf
      </Link>
      <div className="flex gap-2 text-sm">
        <Link href="/credits" className="border border-white/10 px-3 py-2 text-muted hover:text-text">
          Credits
        </Link>
        <form action={logoutAction}>
          <button className="border border-white/10 px-3 py-2 text-muted hover:text-text">Logout</button>
        </form>
      </div>
    </div>
  );
}
