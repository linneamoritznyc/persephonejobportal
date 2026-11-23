/** The Hunt: Platsbanken + career pages, filtered to permanent full-time, deduped, upserted. */
import type { Ctx } from "./context";
import { fetchJobTech } from "../hunt/platsbanken";
import { fetchCompanyFeed } from "../hunt/careers";
import { dedupe, dedupeKey, type RawJob } from "../dedupe";
import { isBlockedCompany, isGigTitle, NON_PERMANENT, findBannedTerm } from "../guard";
import { fetchVetlanda } from "../hunt/local";
import { fetchUsConsulting } from "../hunt/us";

export interface HuntResult { found: number; fresh: number; dropped: { blocked: number; gig: number; temp: number }; errors: string[]; newIds: string[] }

function cacheFor(ctx: Ctx) {
  return {
    async get(key: string) {
      const { data } = await ctx.sb.from("ps_search_cache").select("value,fetched_at").eq("key", key).maybeSingle();
      if (!data) return null;
      return Date.now() - new Date(data.fetched_at).getTime() < 30 * 60_000 ? data.value : null;
    },
    async set(key: string, value: any) {
      await ctx.sb.from("ps_search_cache").upsert({ key, value, fetched_at: new Date().toISOString() });
    },
  };
}

export async function hunt(ctx: Ctx, extraTerms: { q: string; tag?: string; gift?: string }[], log: (m: string) => void): Promise<HuntResult> {
  const errors: string[] = [];
  const blockedNames = ctx.companies.filter((c: any) => c.blocked).map((c: any) => c.name);
  const { data: sources } = await ctx.sb.from("ps_sources").select("id,enabled");
  const on = (id: string) => sources?.find((s: any) => s.id === id)?.enabled !== false;

  const famTerms = ctx.families.filter((f: any) => f.enabled !== false).flatMap((f: any) => [...(f.keywords_en ?? []), ...(f.keywords_sv ?? [])].map((q: string) => ({ q, tag: `family:${f.id}` })));
  const giftTerms = ctx.gifts.flatMap((g: any) => (g.professional_language ?? []).slice(0, 2).map((q: string) => ({ q, tag: `gift:${g.id}`, gift: g.id })));
  const terms = [...famTerms, ...extraTerms, ...giftTerms].filter((t, i, a) => a.findIndex((x) => x.q.toLowerCase() === t.q.toLowerCase()) === i).slice(0, 70);

  let raw: (RawJob & { found_by?: string })[] = [];
  let tempDropped = 0;
  if (on("jobtech")) {
    try {
      const r = await fetchJobTech(terms, { cache: cacheFor(ctx) });
      raw.push(...r.jobs);
      tempDropped += r.dropped;
      log(`Platsbanken: ${r.jobs.length} permanent full-time, ${r.dropped} other dropped`);
    } catch (e: any) {
      errors.push(`jobtech: ${e.message}`);
    }
  }
  if (on("careers")) {
    const feeds = ctx.companies.filter((c: any) => c.feed_url && !c.blocked);
    const res = await Promise.allSettled(feeds.map((c: any) => fetchCompanyFeed({ name: c.name, ats: c.ats, feed_url: c.feed_url, title_filter: c.title_filter })));
    res.forEach((r, i) => (r.status === "fulfilled" ? raw.push(...r.value.map((j) => ({ ...j, found_by: `careers:${feeds[i].name}` }))) : errors.push(`${feeds[i].name}: ${r.reason?.message ?? r.reason}`)));
    log(`Career pages: ${res.filter((r) => r.status === "fulfilled").length}/${feeds.length} feeds read`);
  }

  // Stockholm track rows so far; add the US consulting and Vetlanda local tracks.
  raw = raw.map((j) => ({ ...j, mode: "ai", track: "stockholm" }) as any);
  if (on("us_consulting")) {
    try {
      const us = await fetchUsConsulting();
      raw.push(...us.map((j) => ({ ...j, track: "us", found_by: "us-consulting" }) as any));
      log(`US AI consulting: ${us.length}`);
    } catch (e: any) {
      errors.push(`us: ${e.message}`);
    }
  }
  if (on("local")) {
    try {
      const loc = await fetchVetlanda();
      raw.push(...loc.map((j) => ({ ...j, track: "local", found_by: "vetlanda" }) as any));
      log(`Vetlanda local: ${loc.length}`);
    } catch (e: any) {
      errors.push(`local: ${e.message}`);
    }
  }

  const dropped = { blocked: 0, gig: 0, temp: tempDropped };
  raw = raw.filter((j: any) => {
    if (isBlockedCompany(j.company_name, blockedNames)) return dropped.blocked++, false;
    if (isGigTitle(j.title)) return dropped.gig++, false;
    // Permanent full-time is required on the Stockholm track only.
    if (j.track === "stockholm" && (NON_PERMANENT.test(j.title) || (j.employment_type && !/permanent/i.test(j.employment_type)))) return dropped.temp++, false;
    if (findBannedTerm(`${j.title} ${j.company_name}`)) return dropped.blocked++, false;
    return true;
  });
  const jobs = dedupe(raw);

  const now = new Date().toISOString();
  const newIds: string[] = [];
  const byName = new Map(ctx.companies.map((c: any) => [c.name.toLowerCase(), c]));
  for (let i = 0; i < jobs.length; i += 50) {
    const chunk = jobs.slice(i, i + 50);
    const keys = chunk.map((j) => `${j.source}|${j.external_id}`);
    const { data: existing } = await ctx.sb.from("ps_jobs").select("source,external_id").in("external_id", chunk.map((j) => j.external_id));
    const known = new Set((existing ?? []).map((e: any) => `${e.source}|${e.external_id}`));
    const rows = chunk.map((j: any) => ({
      source: j.source, external_id: j.external_id, title: j.title.slice(0, 300), company_name: j.company_name,
      company_id: byName.get((j.company_name || "").toLowerCase())?.id ?? null, url: j.url, location: j.location,
      municipality: j.municipality ?? null, remote: j.remote, language: j.language ?? null, description: j.description?.slice(0, 20000) ?? null,
      occupation: j.occupation ?? null, salary_min: j.salary_min ?? null, salary_max: j.salary_max ?? null, salary_currency: j.salary_currency ?? "SEK",
      deadline: j.deadline ?? null, last_seen_at: now, is_open: true, raw: j.raw ?? null, employment_type: j.employment_type ?? "Permanent, full-time",
      dedupe_key: dedupeKey(j.title, j.company_name), found_by_term: j.found_by ?? null,
      found_by_gift: j.found_by?.startsWith("gift:") ? j.found_by.slice(5) : null, published_at: j.published_at ?? null,
      track: j.track ?? "stockholm", mode: j.mode ?? "ai",
    }));
    const { data: up, error } = await ctx.sb.from("ps_jobs").upsert(rows, { onConflict: "source,external_id" }).select("id,source,external_id");
    if (error) errors.push(`upsert: ${error.message}`);
    for (const r of up ?? []) if (!known.has(`${r.source}|${r.external_id}`)) newIds.push(r.id);
    void keys;
  }
  // Mark jobs not seen for 3 days in their source as closed (targets are managed by hand).
  await ctx.sb.from("ps_jobs").update({ is_open: false }).neq("source", "target").neq("source", "manual").lt("last_seen_at", new Date(Date.now() - 3 * 86_400_000).toISOString());
  await ctx.sb.from("ps_sources").update({ last_run_at: now, last_status: errors.length ? "partial" : "ok", last_count: jobs.length }).in("id", ["jobtech", "careers", "local", "us_consulting"]);
  return { found: jobs.length, fresh: newIds.length, dropped, errors, newIds };
}
