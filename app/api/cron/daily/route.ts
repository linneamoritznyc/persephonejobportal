import { NextResponse } from "next/server";
import { isAuthorizedCron, isStockholmRunHour } from "@/lib/cron";
import { runAgent } from "@/lib/agent/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron: fires at 04:30 and 05:30 UTC; runs only when it is 06:30 in Stockholm. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !isStockholmRunHour()) return NextResponse.json({ skipped: "not 06:30 in Stockholm" });
  const result = await runAgent({ trigger: "cron" });
  return NextResponse.json(result);
}
