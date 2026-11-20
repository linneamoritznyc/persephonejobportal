/**
 * JobTech JobSearch client (from vetlandajobb lib/jobtech.ts), with the
 * platsbanken-ai fixes: parallel batches, 8 s timeouts, 30-minute search cache
 * and a permanent full-time filter (Tillsvidare / Vanlig anställning + Heltid).
 */
import type { RawJob } from "../dedupe";

const BASE = "https://jobsearch.api.jobtechdev.se";
export const MUNICIPALITIES: Record<string, string> = {
  Stockholm: "AvNB_uwa_6n6",
  Solna: "zHxw_uJZ_NJ8",
  Sundbyberg: "UTJZ_zHH_mJm",
  Nacka: "aYA7_PpG_BqP",
};
const AD_URL = "https://arbetsformedlingen.se/platsbanken/annonser/";

export function isPermanentFullTime(hit: Record<string, any>): { ok: boolean; label: string } {
  const emp = String(hit.employment_type?.label ?? "");
  const dur = String(hit.duration?.label ?? "");
  const extent = String(hit.working_hours_type?.label ?? "");
  const permanent = /vanlig anställning|tillsvidare/i.test(emp) || /tills vidare|tillsvidare/i.test(dur);
  const temp = /behov|sommar|säsong|vikariat|visstid|tidsbegränsad|projekt/i.test(`${emp} ${dur}`);
  const full = /heltid/i.test(extent) || !extent;
  const label = [permanent ? "Permanent" : emp || "Unknown", full ? "full-time" : extent].filter(Boolean).join(", ");
  return { ok: permanent && !temp && full && /heltid/i.test(extent), label };
}

function toRaw(hit: Record<string, any>): RawJob & { employment_type: string; municipality: string; published_at: string | null; keep: boolean } {
  const id = String(hit.id ?? "");
  const salaryText: string = hit.salary_description ?? "";
  const nums = (salaryText.match(/\d[\d\s]{3,}/g) ?? []).map((n) => Number(n.replace(/\s/g, ""))).filter((n) => n > 15000 && n < 300000);
  const pf = isPermanentFullTime(hit);
  return {
    source: "jobtech",
    external_id: id,
    title: hit.headline ?? "",
    company_name: hit.employer?.name ?? hit.employer?.workplace ?? "",
    url: hit.webpage_url || `${AD_URL}${id}`,
    location: [hit.workplace_address?.municipality, hit.workplace_address?.region].filter(Boolean).join(", "),
    municipality: hit.workplace_address?.municipality ?? "",
    remote: Boolean(hit.remote_work),
    language: /\b(the|and|we are|you will)\b/i.test(hit.description?.text ?? "") ? "en" : "sv",
    description: hit.description?.text ?? "",
    occupation: hit.occupation?.label ?? "",
    salary_min: nums.length ? Math.min(...nums) : null,
    salary_max: nums.length ? Math.max(...nums) : null,
    salary_currency: "SEK",
    deadline: hit.application_deadline ? String(hit.application_deadline).slice(0, 10) : null,
    employment_type: pf.label,
    published_at: hit.publication_date ?? null,
    keep: pf.ok,
    raw: {
      occupation_id: hit.occupation?.concept_id,
      must_have: (hit.must_have?.skills ?? []).map((s: any) => s.label),
      nice_to_have: (hit.nice_to_have?.skills ?? []).map((s: any) => s.label),
      apply_url: hit.application_details?.url ?? null,
      employer_url: hit.employer?.url ?? null,
    },
  };
}

type Cache = { get(k: string): Promise<any | null>; set(k: string, v: any): Promise<void> };

async function search(params: Record<string, string>, cache?: Cache): Promise<ReturnType<typeof toRaw>[]> {
  const qs = new URLSearchParams({ limit: "40", sort: "pubdate-desc", ...params });
  const key = `jobsearch:${qs.toString()}`;
  const hit = await cache?.get(key);
  if (hit) return hit;
  const res = await fetch(`${BASE}/search?${qs}`, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`JobSearch HTTP ${res.status}`);
  const data = await res.json();
  const out = (data.hits ?? []).map(toRaw);
  await cache?.set(key, out);
  return out;
}

export async function fetchJobTech(terms: { q: string; tag?: string }[], opts: { days?: number; cache?: Cache } = {}) {
  const after = new Date(Date.now() - (opts.days ?? 21) * 86_400_000).toISOString().slice(0, 19);
  const muni = Object.values(MUNICIPALITIES);
  const out: (ReturnType<typeof toRaw> & { found_by: string })[] = [];
  let dropped = 0;
  for (let i = 0; i < terms.length; i += 10) {
    const batch = terms.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (t) => {
        const qs: Record<string, string> = { q: t.q, "published-after": after };
        const p = new URLSearchParams(qs);
        muni.forEach((m) => p.append("municipality", m));
        const list = await search(Object.fromEntries(p) as any, opts.cache).catch(async () => search({ ...qs, municipality: muni[0] }, opts.cache));
        return list.map((j) => ({ ...j, found_by: t.tag ?? t.q }));
      })
    );
    for (const r of results) if (r.status === "fulfilled") for (const j of r.value) (j.keep ? out.push(j) : dropped++);
  }
  return { jobs: out, dropped };
}

/** Full ad text, fetched lazily for drafting. */
export async function fetchAd(id: string): Promise<string | null> {
  const res = await fetch(`${BASE}/ad/${id}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const d = await res.json();
  return d.description?.text ?? null;
}
