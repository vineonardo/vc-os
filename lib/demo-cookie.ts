export const DEMO_SESSION_COOKIE = "vw_demo_session";

export function normalizeDemoSessionId(value?: string | null) {
  return (value || "shared-demo").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "shared-demo";
}
