/** Scores one job with both methods and stores them in ps_matches. */
import type { Ctx } from "./context";
import type { Understanding } from "./understand";
import { calculateFitScore, type Importance } from "../score/crosstrees";
import { scoreJobVetlanda } from "../score/vetlanda";
import { finalRank } from "../score/rank";
import { normalizeSkill, tierFor } from "../match";
import { salaryFor } from "../salary";

export async function scoreAndStore(ctx: Ctx, job: any, u: Understanding) {
  const mine = ctx.index.mineSet();
  const jobMap = new Map<string, Importance>();
  const labels: string[] = [];
  const rows: any[] = [];
  for (const s of u.skills ?? []) {
    const mapped = ctx.index.match(s.name);
    const key = normalizeSkill(mapped ?? s.name);
    if (!jobMap.has(key)) jobMap.set(key, s.importance);
    labels.push(mapped ?? s.name);
    rows.push({ job_id: job.id, skill_name: s.name.slice(0, 120), importance: s.importance, years_required: s.years ?? null, extracted_by: "claude-haiku" });
  }
  await ctx.sb.from("ps_job_skills").delete().eq("job_id", job.id);
  if (rows.length) await ctx.sb.from("ps_job_skills").upsert(rows, { onConflict: "job_id,skill_name" });

  const fit = calculateFitScore(mine, jobMap);
  const v = scoreJobVetlanda(mine, labels, `${job.title} ${job.description ?? ""}`);
  const company = ctx.companies.find((c: any) => c.id === job.company_id || c.name === job.company_name);
  const gr = u.gift_read;
  const rank = finalRank({ vetlanda: v.score, crosstreesCiLow: fit?.ci_low ?? null, giftFit: gr?.gift_fit, primaryGift: gr?.primary_gift, isBig: !!company?.is_big_company, deadline: job.deadline });
  const band = salaryFor(job.title, job.description ?? "");
  const family = u.family ?? job.family_id ?? null;
  const yearsGap = u.years_required != null ? Math.max(0, u.years_required - 5) : null;
  const pretty = (s: string) => ctx.skills.find((x) => normalizeSkill(x.name) === s)?.name ?? s;
  const why = fit
    ? `Has ${fit.matched_required.length} of ${fit.matched_required.length + fit.missing_required.length} required skills${fit.missing_required.length ? `; gaps: ${fit.missing_required.slice(0, 3).map(pretty).join(", ")}` : ""}.`
    : "No structured skills in the ad; scored on title and text.";
  const common = {
    job_id: job.id, family_id: family, years_gap: yearsGap, salary_estimate_min: job.salary_min ?? band.low,
    salary_estimate_max: job.salary_max ?? band.high, gift_read: gr ?? null, primary_gift: gr?.primary_gift ?? null,
    updated_at: new Date().toISOString(),
  };
  await ctx.sb.from("ps_matches").upsert(
    [
      { ...common, method: "vetlandajobb_v1", score: v.score, matched: v.matched.map(pretty), missing_required: v.missing.map(pretty), rank_score: rank, tier: tierFor(v.score), why: `${v.matched.length} of ${v.matched.length + v.missing.length} listed skills.` },
      ...(fit
        ? [{ ...common, method: "crosstrees_v1", score: fit.score, ci_low: fit.ci_low, ci_high: fit.ci_high, matched: fit.matched.map(pretty), missing_required: fit.missing_required.map(pretty), missing_preferred: fit.missing_preferred.map(pretty), rank_score: rank, tier: tierFor(fit.score), why }]
        : []),
    ],
    { onConflict: "job_id,method" }
  );
  if (family && !job.family_id) await ctx.sb.from("ps_jobs").update({ family_id: family }).eq("id", job.id);
  return { vetlanda: v.score, crosstrees: fit?.score ?? null, ci_low: fit?.ci_low ?? null, rank, primary_gift: gr?.primary_gift ?? null, family };
}
