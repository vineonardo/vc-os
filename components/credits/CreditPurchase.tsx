"use client";

import Script from "next/script";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function CreditPurchase({
  minCredits,
  creditPricePaise,
}: {
  minCredits: number;
  creditPricePaise: number;
}) {
  const [credits, setCredits] = useState(minCredits);
  const [status, setStatus] = useState<string | null>(null);

  async function buyCredits() {
    setStatus("Creating order...");

    try {
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      const order = (await response.json()) as {
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        error?: string;
      };
      if (!response.ok || !order.orderId) throw new Error(order.error || "Could not create order.");
      if (!window.Razorpay) throw new Error("Razorpay checkout did not load.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Venture Wolf",
        description: `${credits} credits`,
        order_id: order.orderId,
        handler: async (payment: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          const payload = (await verify.json()) as { balance?: number; error?: string };
          if (!verify.ok) throw new Error(payload.error || "Payment verification failed.");
          setStatus(`Payment verified. Balance: ${payload.balance} credits.`);
        },
      });

      checkout.open();
      setStatus("Checkout opened.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    }
  }

  return (
    <div className="border border-white/10 bg-card p-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <label className="block text-sm text-muted" htmlFor="credits">
        Credits to buy
      </label>
      <input
        id="credits"
        min={minCredits}
        step={10}
        type="number"
        value={credits}
        onChange={(event) => setCredits(Number(event.target.value))}
        className="mt-2 h-11 w-full border border-white/10 bg-surface px-3 text-text outline-none focus:border-gold/60"
      />
      <div className="mt-3 text-sm text-muted">
        Minimum {minCredits} credits : Rs {(minCredits * creditPricePaise) / 100}
      </div>
      <button
        type="button"
        onClick={buyCredits}
        className="mt-4 h-11 w-full bg-gold px-4 text-sm font-semibold text-blackwolf transition hover:bg-[#ffd45d]"
      >
        Buy Credits
      </button>
      {status && <div className="mt-3 text-sm text-muted">{status}</div>}
    </div>
  );
}
