import { cn } from "@/lib/utils";
import type { ReadinessLabel } from "@/types";

const tone: Record<ReadinessLabel, string> = {
  "Most Promising": "border-green/30 bg-green/10 text-green",
  "High Potential": "border-blue/30 bg-blue/10 text-blue",
  "Needs Mentorship": "border-amber/30 bg-amber/10 text-amber",
  "Early Stage": "border-red/30 bg-red/10 text-red",
};

export function ScorePill({
  score,
  label,
}: {
  score: number | null;
  label: ReadinessLabel | null;
}) {
  const resolvedLabel = label || "Early Stage";

  return (
    <div className={cn("inline-flex items-center gap-2 border px-2.5 py-1 text-xs", tone[resolvedLabel])}>
      <span>{resolvedLabel}</span>
      <span className="font-semibold">{score ?? 0}</span>
    </div>
  );
}
