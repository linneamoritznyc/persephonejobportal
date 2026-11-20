/**
 * JobTech JobSearch client (adapted from vetlandajobb lib/jobtech.ts).
 * Stockholm municipality plus remote-in-Sweden, one query per keyword.
 */
import type { RawJob } from "../dedupe";

const BASE = "https://jobsearch.api.jobtechdev.se";
export const STOCKHOLM_CONCEPT_ID = "AvNB_uwa_6n6";
const AD_URL = "https://arbetsformedlingen.se/platsbanken/annonser/";

function toRaw(hit: Record<string, any>): RawJob {
  const id = String(hit.id ?? "");
  const salaryText: string = hit.salary_description ?? "";
  const nums = (salaryText.match(/\d[\d\s]{3,}/g) ?? []).map((n) => Number(n.replace(/\s/g, ""))).filter((n) => n > 15000 && n < 300000);
  return {
    source: "jobtech",
    external_id: id,
    title: hit.headline ?? "",
    company_name: hit.employer?.name ?? hit.employer?.workplace ?? "",
    url: hit.webpage_url || `${AD_URL}${id}`,
    location: [hit.workplace_address?.municipality, hit.workplace_address?.region].filter(Boolean).join(", "),
    remote: Boolean(hit.remote_work) || /distans|remote/i.test(hit.headline ?? ""),
    language: /\b(the|and|we are|you will)\b/i.test(hit.description?.text ?? "") ? "en" : "sv",
    description: hit.description?.text ?? "",
    occupation: hit.occupation?.label ?? "",
    salary_min: nums.length ? Math.min(...nums) : null,
    salary_max: nums.length ? Math.max(...nums) : null,
    salary_currency: "SEK",
    deadline: hit.application_deadline ? String(hit.application_deadline).slice(0, 10) : null,
    raw: {
      occupation_id: hit.occupation?.concept_id,
      must_have: (hit.must_have?.skills ?? []).map((s: any) => s.label),
      nice_to_have: (hit.nice_to_have?.skills ?? []).map((s: any) => s.label),
      apply_url: hit.application_details?.url ?? null,
      apply_email: hit.application_details?.email ?? null,
      employer_url: hit.employer?.url ?? null,
      published: hit.publication_date,
    },
  };
}

async function search(params: Record<string, string>): Promise<RawJob[]> {
  const qs = new URLSearchParams({ limit: "50", sort: "pubdate-desc", ...params });
  const res = await fetch(`${BASE}/search?${qs}`, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`JobSearch HTTP ${res.status}`);
  const data = await res.json();
  return (data.hits ?? []).map(toRaw);
}

export async function fetchJobTech(keywords: string[], publishedAfterDays = 21): Promise<RawJob[]> {
  const after = new Date(Date.now() - publishedAfterDays * 86_400_000).toISOString().slice(0, 19);
  const out: RawJob[] = [];
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))];
  // Run in small parallel batches to stay polite.
  for (let i = 0; i < unique.length; i += 6) {
    const batch = unique.slice(i, i + 6);
    const results = await Promise.allSettled(
      batch.flatMap((q) => [
        search({ q, municipality: STOCKHOLM_CONCEPT_ID, "published-after": after }),
        search({ q, remote: "true", "published-after": after }),
      ])
    );
    for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  }
  return out;
}
