import "server-only";
import { cookies } from "next/headers";

export type Mode = "ai" | "local";
export const MODES: Record<Mode, { label: string; short: string; blurb: string }> = {
  ai: { label: "AI · Stockholm & US", short: "AI", blurb: "High-paying AI roles in Stockholm and US AI consulting." },
  local: { label: "Lokalt · Vetlanda", short: "Lokalt", blurb: "Jobb på plats i Vetlanda: industri, hemtjänst, vikarie och mer." },
};

export async function getMode(): Promise<Mode> {
  const c = (await cookies()).get("ps_mode")?.value;
  return c === "local" ? "local" : "ai";
}
