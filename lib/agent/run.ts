/** The daily agent (03 s13 / 02 s11). Never sends email: every mail action is an IMAP draft. */
import { db } from "../supabase/admin";
import { CostMeter } from "../claude";
import { loadCtx } from "./context";
import { runDiscovery } from "./discover";
import { hunt } from "./hunt";
import { understandJob } from "./understand";
import { scoreAndStore } from "./score";
import { writeApplication, saveWritten, GuardRejection } from "./write";
import { pushApplicationDraft, pushNote } from "./draft";
import { morningBrief, linkedinPost } from "./brief";
import { syncSent } from "./sync";
import { draftsConfigured } from "../mail/imapDraft";
import { BannedTermError } from "../guard";

export interface RunOpts { trigger: "cron" | "manual" | "api"; dryRun?: boolean; budgetMs?: number; maxUnderstand?: number; draftTop?: number }

export async function runAgent(opts: RunOpts) {
  const sb = db();
  const started = Date.now();
  const budget = opts.budgetMs ?? 270_000;
  const left = () => budget - (Date.now() - started);
  const dryRun = opts.dryRun ?? process.env.DRY_RUN === "1";
  const meter = new CostMeter();
  const log: string[] = [];
  const errors: string[] = [];
  let guard = 0;
  const say = (m: string) => log.push(`${new Date().toISOString().slice(11, 19)} ${m}`);

  const { data: paused } = await sb.from("ps_settings").select("value").eq("key", "cron_paused").maybeSingle();
  if (opts.trigger === "cron" && paused?.value === true) return { skipped: "paused" };

  const { data: run } = await sb.from("ps_agent_runs").insert({ trigger: opts.trigger, dry_run: dryRun }).select("id").single();
  const runId = run!.id as string;
  const counts = { jobs_found: 0, jobs_new: 0, matches_created: 0, drafts_created: 0, gmail_drafts: 0 };

  try {
    const ctx = await loadCtx(sb);
    say(`Context: ${ctx.facts.length} facts, ${ctx.skills.length} skills`);

    // 1-2. Discovery terms, then the hunt
    const disc = await runDiscovery(ctx);
    say(`Kompetensgrafen: ${disc.discovered.length} occupations, expected hits ${disc.expectedHits.length}/10, converged ${disc.converged}`);
    if (disc.expectedHits.length < 3) errors.push("data: Kompetensgrafen surfaced fewer than 3 expected occupations");
    const h = await hunt(ctx, disc.terms, say);
    counts.jobs_found = h.found;
    counts.jobs_new = h.fresh;
    errors.push(...h.errors);
    say(`Hunt: ${h.found} kept, ${h.fresh} new, dropped blocked ${h.dropped.blocked}, gig ${h.dropped.gig}, non-permanent ${h.dropped.temp}`);

    // 4. Understand + score: new jobs first, then any open job without a crosstrees score
    const { data: unscored } = await sb.from("ps_jobs").select("*").eq("is_open", true).is("understood_at", null).is("blocked_reason", null).order("first_seen_at", { ascending: false }).limit(opts.maxUnderstand ?? 120);
    const queue = [...(unscored ?? [])];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length && left() > 120_000) {
        const job = queue.shift()!;
        try {
          const u = await understandJob(ctx, job, meter);
          if (u.permanent_full_time === false) {
            await sb.from("ps_jobs").update({ blocked_reason: "not permanent full-time", understood_at: new Date().toISOString() }).eq("id", job.id);
            continue;
          }
          await scoreAndStore(ctx, job, u);
          await sb.from("ps_jobs").update({ understood_at: new Date().toISOString() }).eq("id", job.id);
          counts.matches_created++;
        } catch (e: any) {
          errors.push(`understand ${job.title}: ${e.message}`);
        }
      }
    });
    await Promise.all(workers);
    say(`Scored ${counts.matches_created} jobs`);

    // 5. Draft: AI mode top 5 above 70, Local mode top 3 above 60 (no application yet)
    const { data: apps } = await sb.from("ps_applications").select("job_id");
    const has = new Set((apps ?? []).map((a: any) => a.job_id));
    const blockedIds = new Set(ctx.companies.filter((c: any) => c.blocked).map((c: any) => c.id));
    const pickFor = async (mode: "ai" | "local", min: number, n: number) => {
      const { data: top } = await sb
        .from("ps_matches")
        .select("job_id,rank_score,score,primary_gift,gift_read,family_id,ps_jobs!inner(*)")
        .eq("method", "crosstrees_v1")
        .eq("ps_jobs.is_open", true)
        .eq("ps_jobs.mode", mode)
        .is("ps_jobs.blocked_reason", null)
        .neq("ps_jobs.status", "closed")
        .gte("rank_score", min)
        .order("rank_score", { ascending: false })
        .limit(25);
      return (top ?? []).filter((m: any) => !has.has(m.job_id) && !blockedIds.has(m.ps_jobs.company_id)).slice(0, n);
    };
    const picks = [...(await pickFor("ai", 70, opts.draftTop ?? 5)), ...(await pickFor("local", 60, 3))];
    for (const m of picks) {
      if (left() < 45_000) break;
      try {
        const w = await writeApplication(ctx, (m as any).ps_jobs, m as any, meter);
        const appId = await saveWritten(ctx, m.job_id, w);
        counts.drafts_created++;
        if (draftsConfigured()) {
          const r = await pushApplicationDraft(sb, appId, { dryRun });
          if (r.ok) counts.gmail_drafts++;
        }
      } catch (e: any) {
        if (e instanceof GuardRejection || e instanceof BannedTermError) {
          guard++;
          errors.push(`guard: ${(m as any).ps_jobs.title}: ${e.message}`);
        } else errors.push(`draft ${(m as any).ps_jobs.title}: ${e.message}`);
      }
    }
    say(`Drafts written ${counts.drafts_created}, Gmail drafts ${counts.gmail_drafts}${draftsConfigured() ? "" : " (Gmail app password missing)"}`);

    // 6. Mondays: LinkedIn post draft
    const now = new Date();
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/Stockholm" }).format(now);
    if (weekday === "Monday" && left() > 30_000) {
      try {
        const p = await linkedinPost(ctx, now, meter);
        await sb.from("ps_drafts").insert({ kind: "linkedin_post", subject: p.subject, body: p.text });
        await pushNote(p.subject, p.text, dryRun);
        if (Math.floor(now.getTime() / (7 * 86_400_000)) % 2 === 0)
          await sb.from("ps_events").insert({ kind: "proof_drop", title: "Proof drop: one small demo for the top target this week", due_date: now.toISOString().slice(0, 10) });
      } catch (e: any) {
        if (e instanceof GuardRejection) guard++;
        errors.push(`linkedin post: ${e.message}`);
      }
    }

    // 8. Read Drafts and Sent to detect what Linnea sent
    try {
      const n = await syncSent(ctx);
      if (n) say(`Marked ${n} applications sent`);
    } catch (e: any) {
      errors.push(`sync: ${e.message}`);
    }

    // 9. Morning brief
    try {
      const b = await morningBrief(ctx, now);
      await sb.from("ps_drafts").insert({ kind: "morning_brief", subject: b.subject, body: b.text });
      if (draftsConfigured()) await pushNote(b.subject, b.text, dryRun);
    } catch (e: any) {
      if (e instanceof GuardRejection) guard++;
      errors.push(`brief: ${e.message}`);
    }
  } catch (e: any) {
    errors.push(`fatal: ${e.message}`);
  } finally {
    await sb
      .from("ps_agent_runs")
      .update({ ...counts, finished_at: new Date().toISOString(), status: errors.some((e) => e.startsWith("fatal")) ? "failed" : "done", errors, log, guard_rejections: guard, cost_usd: Math.round(meter.usd * 10000) / 10000 })
      .eq("id", runId);
  }
  return { runId, ...counts, guard_rejections: guard, errors, cost_usd: meter.usd, log };
}
