"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const purchaseOptions = [100, 250, 500];

export function DemoCreditPurchase() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);

  async function buyCredits(credits: number) {
    setPendingAmount(credits);
    setStatus(null);

    try {
      const response = await fetch("/api/demo-credits/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      const payload = (await response.json()) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not add credits.");
      setStatus(`Added ${credits} credits. Balance: ${payload.balance}.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add credits.");
    } finally {
      setPendingAmount(null);
    }
  }

  return (
    <div className="border border-white/10 bg-card p-5">
      <div className="font-heading font-semibold">Buy credits</div>
      <div className="mt-4 grid gap-2">
        {purchaseOptions.map((credits) => (
          <button
            key={credits}
            type="button"
            disabled={pendingAmount !== null}
            onClick={() => buyCredits(credits)}
            className="h-11 bg-gold px-4 text-sm font-semibold text-blackwolf transition hover:bg-[#ffd45d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAmount === credits ? "Adding..." : `Buy ${credits}`}
          </button>
        ))}
      </div>
      {status && <div className="mt-3 text-sm text-muted">{status}</div>}
    </div>
  );
}
