/** Kompetensgrafen discovery: Personalized PageRank + overlap over ps_occupations. */
import type { Ctx } from "./context";
import { personalizedPageRank } from "../gifts/pagerank";
import { normalizeSkill } from "../match";
import { SEED_OCCUPATIONS } from "../seed/graph";

export const EXPECTED = ["solutions_engineer", "deployment_strategist", "forward_deployed_engineer", "marketing_technologist", "ad_tech_specialist", "creative_technologist", "customer_success_engineer", "policy_analyst", "learning_experience_designer", "program_manager_impact"];

export async function runDiscovery(ctx: Ctx) {
  const [{ data: occ }, { data: edges }, { data: links }, { data: esco }] = await Promise.all([
    ctx.sb.from("ps_occupations").select("id,name,alt_titles,gift_id,is_seed"),
    ctx.sb.from("ps_occupation_edges").select("source_id,target_id,score"),
    ctx.sb.from("ps_occupation_skills").select("occupation_id,skill_id,importance"),
    ctx.sb.from("ps_skills_esco").select("id,name"),
  ]);
  const nodes = (occ ?? []).map((o: any) => o.id);
  const seeds = (occ ?? []).filter((o: any) => o.is_seed).map((o: any) => o.id);
  const { rank, delta } = personalizedPageRank(nodes, (edges ?? []) as any, seeds.length ? seeds : SEED_OCCUPATIONS);
  const mine = ctx.index.mineSet();
  const skillName = new Map((esco ?? []).map((s: any) => [s.id, s.name]));
  const results: any[] = [];
  for (const o of occ ?? []) {
    const req = (links ?? []).filter((l: any) => l.occupation_id === o.id).map((l: any) => skillName.get(l.skill_id) as string).filter(Boolean);
    const have = req.filter((s) => mine.has(normalizeSkill(ctx.index.match(s) ?? s)));
    const overlap = req.length ? Math.round((have.length / req.length) * 100) : null;
    const gap = req.filter((s) => !have.includes(s));
    results.push({ id: o.id, name: o.name, alt: o.alt_titles ?? [], pagerank: rank.get(o.id) ?? 0, overlap, gap, gift: o.gift_id, seed: o.is_seed });
  }
  for (const r of results) await ctx.sb.from("ps_occupations").update({ pagerank: r.pagerank, overlap: r.overlap, gap_skills: r.gap }).eq("id", r.id);
  const discovered = results.filter((r) => !r.seed && (r.overlap ?? 0) >= 40).sort((a, b) => b.pagerank * (b.overlap ?? 0) - a.pagerank * (a.overlap ?? 0)).slice(0, 25);
  const hits = EXPECTED.filter((e) => discovered.some((d) => d.id === e));
  const terms = discovered.flatMap((d) => [d.name, ...d.alt.slice(0, 2)].map((q: string) => ({ q, tag: `discovery:${d.id}`, gift: d.gift })));
  return { converged: delta < 1e-4, delta, discovered, expectedHits: hits, terms };
}
