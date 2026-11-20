import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { runAgent } from "@/lib/agent/run";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Run now, with a 1-minute cooldown. Body: { dryRun?: boolean } */
export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const { data: last } = await db().from("ps_agent_runs").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.started_at).getTime() < 60_000) return NextResponse.json({ error: "Cooldown: wait a minute between runs" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const result = await runAgent({ trigger: auth.who === "admin-token" ? "api" : "manual", dryRun: !!body.dryRun });
  return NextResponse.json(result);
}
