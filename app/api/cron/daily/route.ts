import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runAgent } from "@/lib/agent/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron (Hobby: once a day): 05:30 UTC, which is 06:30 in Stockholm in winter and 07:30 in summer. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runAgent({ trigger: "cron" });
  return NextResponse.json(result);
}
