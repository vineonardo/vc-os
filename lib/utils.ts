import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCredits(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function readinessLabel(score: number) {
  if (score >= 80) return "Most Promising";
  if (score >= 60) return "High Potential";
  if (score >= 40) return "Needs Mentorship";
  return "Early Stage";
}

export function jsonResponse(payload: unknown, init?: ResponseInit) {
  return Response.json(payload, init);
}
