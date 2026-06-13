"use client";

import { Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCredits } from "@/lib/utils";

export function CreditBadge({
  userId,
  initialBalance,
}: {
  userId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    if (!userId || userId === "demo") return;

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    try {
      const supabase = createClient();
      channel = supabase
        .channel(`credits:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "credits",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const next = payload.new as { balance?: number };
            if (typeof next.balance === "number") setBalance(next.balance);
          },
        )
        .subscribe();
    } catch {
      return;
    }

    return () => {
      if (channel) void createClient().removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  return (
    <div className="inline-flex h-10 items-center gap-2 border border-gold/30 bg-[rgba(255,192,28,0.1)] px-3 text-sm text-text">
      <Coins className="h-4 w-4 text-gold" />
      <span className="text-muted">Credits</span>
      <span className="font-semibold text-gold">{formatCredits(balance)}</span>
    </div>
  );
}
