import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { runAgent } from "@/lib/agent/run";
import { loadCtx } from "@/lib/agent/context";
import { understandJob } from "@/lib/agent/understand";
import { scoreAndStore } from "@/lib/agent/score";
import { writeApplication, saveWritten } from "@/lib/agent/write";
import { CostMeter } from "@/lib/claude";
import { saveDraft, draftsConfigured, draftsAccount } from "@/lib/mail/imapDraft";
import { pushApplicationDraft } from "@/lib/agent/draft";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TOOLS = {
  run_agent: "Run the daily agent now. args: { dryRun?: boolean }",
  pause_cron: "Pause or resume the daily cron. args: { paused: boolean }",
  toggle_source: "Enable or disable a source. args: { id: 'jobtech'|'careers'|'discovery', enabled: boolean }",
  set_family_keywords: "Replace a role family's keywords. args: { id: '1'..'6', keywords_en?: string[], keywords_sv?: string[], enabled?: boolean }",
  rescore: "Re-run skill extraction and both fit scores for one job or all open jobs. args: { jobId?: string }",
  regenerate_draft: "Rewrite the letter, email and LinkedIn note for a job. args: { jobId: string, instruction?: string }",
  list_runs: "Last 20 agent runs. args: {}",
  list_matches: "Top matches. args: { limit?: number }",
  test_draft: "Save one test draft (no attachments) in the drafts account to check the IMAP connection. Never sends. args: {}",
  push_drafts: "Save every written application that has no Gmail draft yet into Gmail Drafts. Never sends. args: {}",
};

/**
 * MCP-style JSON endpoint. GET lists the tools. POST { tool, args } calls one.
 * Auth: the logged-in owner or Authorization: Bearer PERSEPHONE_ADMIN_TOKEN.
 * No tool can send email.
 */
export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return NextResponse.json({ name: "persephone-oracle", tools: TOOLS });
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const { tool, args = {} } = await req.json().catch(() => ({}));
  const sb = db();
  try {
    switch (tool) {
      case "run_agent":
        return NextResponse.json(await runAgent({ trigger: "api", dryRun: !!args.dryRun }));
      case "pause_cron":
        await sb.from("ps_settings").upsert({ key: "cron_paused", value: !!args.paused, updated_at: new Date().toISOString() });
        return NextResponse.json({ ok: true, paused: !!args.paused });
      case "toggle_source":
        await sb.from("ps_sources").update({ enabled: !!args.enabled }).eq("id", args.id);
        return NextResponse.json({ ok: true });
      case "set_family_keywords": {
        const patch: any = {};
        if (args.keywords_en) patch.keywords_en = args.keywords_en;
        if (args.keywords_sv) patch.keywords_sv = args.keywords_sv;
        if (typeof args.enabled === "boolean") patch.enabled = args.enabled;
        await sb.from("ps_role_families").update(patch).eq("id", args.id);
        return NextResponse.json({ ok: true });
      }
      case "rescore": {
        const ctx = await loadCtx(sb);
        const q = sb.from("ps_jobs").select("*").eq("is_open", true).is("blocked_reason", null);
        const { data: jobs } = args.jobId ? await q.eq("id", args.jobId) : await q.limit(40);
        const meter = new CostMeter();
        let n = 0;
        for (const j of jobs ?? []) {
          const u = await understandJob(ctx, j, meter);
          await scoreAndStore(ctx, j, u);
          await sb.from("ps_jobs").update({ understood_at: new Date().toISOString() }).eq("id", j.id);
          n++;
        }
        return NextResponse.json({ ok: true, rescored: n, cost_usd: meter.usd });
      }
      case "regenerate_draft": {
        const ctx = await loadCtx(sb);
        const { data: job } = await sb.from("ps_jobs").select("*").eq("id", args.jobId).single();
        const { data: m } = await sb.from("ps_matches").select("*").eq("job_id", args.jobId).eq("method", "crosstrees_v1").maybeSingle();
        const w = await writeApplication(ctx, job, m ?? {}, undefined, args.instruction);
        const appId = await saveWritten(ctx, args.jobId, w);
        return NextResponse.json({ ok: true, applicationId: appId, letter: w.letter, linkedin: w.linkedin });
      }
      case "list_runs": {
        const { data } = await sb.from("ps_agent_runs").select("*").order("started_at", { ascending: false }).limit(20);
        return NextResponse.json(data);
      }
      case "list_matches": {
        const { data } = await sb.from("ps_matches").select("score,ci_low,ci_high,rank_score,why,primary_gift,ps_jobs!inner(id,title,company_name,deadline,url,blocked_reason)").eq("method", "crosstrees_v1").is("ps_jobs.blocked_reason", null).order("rank_score", { ascending: false }).limit(args.limit ?? 20);
        return NextResponse.json(data);
      }
      case "test_draft": {
        if (!draftsConfigured()) return NextResponse.json({ ok: false, error: "GMAIL_DRAFTS_APP_PASSWORD is not visible to this deployment" });
        const r = await saveDraft({ subject: "Persephone test draft", text: "This is a test draft from Persephone. It was saved by IMAP into your Drafts folder and was never sent. You can delete it." });
        return NextResponse.json({ ok: true, account: draftsAccount(), ...r });
      }
      case "push_drafts": {
        const { data: apps } = await sb.from("ps_applications").select("id,ps_drafts(kind,gmail_drafted_at)").eq("status", "drafted");
        const todo = (apps ?? []).filter((a: any) => !(a.ps_drafts ?? []).some((d: any) => d.kind === "email" && d.gmail_drafted_at));
        const out: any[] = [];
        for (const a of todo) out.push({ id: a.id, ...(await pushApplicationDraft(sb, a.id).catch((e: any) => ({ ok: false, reason: e.message }))) });
        return NextResponse.json({ ok: true, pushed: out.filter((x) => x.ok).length, results: out });
      }
      default:
        return NextResponse.json({ error: "Unknown tool", tools: TOOLS }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
