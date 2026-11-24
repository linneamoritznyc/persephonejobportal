/** Local mode: every current ad in Vetlanda and nearby municipalities (omnejd) from Platsbanken, all employment types. */
import type { RawJob } from "../dedupe";

export const VETLANDA = "xJqx_SLC_415";
/** Vetlanda plus the municipalities around it: Eksjö, Sävsjö, Nässjö, Uppvidinge, Hultsfred. */
export const OMNEJD: Record<string, string> = {
  Vetlanda: VETLANDA,
  "Eksjö": "VacK_WF6_XVg",
  "Sävsjö": "L1cX_MjM_y8W",
  "Nässjö": "KfXT_ySA_do2",
  Uppvidinge: "78cu_S5T_Pgp",
  Hultsfred: "AEQD_1RT_vM9",
};
const AD_URL = "https://arbetsformedlingen.se/platsbanken/annonser/";

export async function fetchVetlanda(): Promise<(RawJob & { mode: "local" })[]> {
  const out: (RawJob & { mode: "local" })[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const qs = new URLSearchParams({ limit: "100", offset: String(offset), sort: "pubdate-desc" });
    for (const id of Object.values(OMNEJD)) qs.append("municipality", id);
    const res = await fetch(`https://jobsearch.api.jobtechdev.se/search?${qs}`, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`JobSearch HTTP ${res.status}`);
    const data = await res.json();
    const hits: any[] = data.hits ?? [];
    for (const h of hits) {
      const id = String(h.id);
      const emp = [h.employment_type?.label, h.duration?.label, h.working_hours_type?.label].filter(Boolean).join(", ");
      out.push({
        mode: "local",
        source: "jobtech-local",
        external_id: id,
        title: h.headline ?? "",
        company_name: h.employer?.name ?? "",
        url: h.webpage_url || `${AD_URL}${id}`,
        location: h.workplace_address?.municipality ?? "Vetlanda",
        municipality: h.workplace_address?.municipality ?? "Vetlanda",
        remote: false,
        language: "sv",
        description: h.description?.text ?? "",
        occupation: h.occupation?.label ?? "",
        deadline: h.application_deadline ? String(h.application_deadline).slice(0, 10) : null,
        employment_type: emp || "Okänd",
        published_at: h.publication_date ?? null,
        raw: { must_have: (h.must_have?.skills ?? []).map((s: any) => s.label), apply_email: h.application_details?.email ?? null, apply_url: h.application_details?.url ?? null },
      });
    }
    if (hits.length < 100) break;
  }
  return out;
}

// ---- Ported from vetlandajobb (lib/scraper.ts, lib/jobtech.ts) ----

type LocalJob = RawJob & { mode: "local" };

/**
 * Vetlanda kommun's own job site (Visma Recruit list rendered into the page as JSON).
 * Catches kommun ads that never reach Platsbanken, plus the standing timvikarie signup.
 * Idea and fallback from vetlandajobb lib/scraper.ts; parsing tightened to the real data. Best effort: [] on any problem.
 */
export async function fetchVetlandaSe(): Promise<LocalJob[]> {
  const base = "https://jobb.vetlanda.se";
  const out: LocalJob[] = [{
    mode: "local", source: "vetlanda.se", external_id: "timvikarie", title: "Timvikarie i Vetlanda kommun (skola, förskola, omsorg)",
    company_name: "Vetlanda kommun", url: `${base}/jobba-i-vetlanda/jobba-flexibelt---bli-timvikarie`, location: "Vetlanda", municipality: "Vetlanda",
    remote: false, language: "sv", description: "Vetlanda kommun söker timvikarier till skola, förskola, äldreomsorg och stöd. Anmälan görs på kommunens jobbsida.",
    occupation: "Vikarie", employment_type: "Timanställning",
  }];
  try {
    const res = await fetch(`${base}/jobba-i-vetlanda/lediga-jobb`, { headers: { "user-agent": "Mozilla/5.0 (Persephone personal job search)" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return out;
    const html = await res.text();
    const m = html.match(/registerInitialState\('[^']+',(\{"isError".*?\})\);<\/script>/s);
    if (!m) return out;
    const data = JSON.parse(m[1]);
    for (const a of data.assignments ?? []) {
      const end = a.applicationEndDate && !a.applicationEndDate.startsWith("1753") ? String(a.applicationEndDate).slice(0, 10) : null;
      out.push({
        mode: "local", source: "vetlanda.se", external_id: String(a.guid), title: a.title ?? "", company_name: "Vetlanda kommun",
        url: new URL(a.url, base).toString(), location: "Vetlanda", municipality: "Vetlanda", remote: false, language: "sv",
        description: [a.description, a.department?.name, a.occupation?.name, a.grade, a.type].filter(Boolean).join(". "),
        occupation: a.occupation?.name ?? "", deadline: end, employment_type: [a.type, a.grade].filter(Boolean).join(", ") || "Okänd",
        published_at: a.publishStartDate ?? null,
      });
    }
  } catch {
    // keep the timvikarie entry
  }
  return out;
}

/** Fallback when JobSearch is down: Platsbanken's own search API, same filter list. */
export async function fetchPlatsbankenDirect(): Promise<LocalJob[]> {
  const res = await fetch("https://platsbanken-api.arbetsformedlingen.se/jobs/v1/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filters: Object.values(OMNEJD).map((value) => ({ type: "municipality", value })), fromDate: null, order: "date", maxRecords: 100, startIndex: 0, source: "pb" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Platsbanken API HTTP ${res.status}`);
  const data = await res.json();
  return (data.ads ?? []).map((ad: any) => {
    const id = String(ad.id ?? "");
    return {
      mode: "local", source: "jobtech-local", external_id: id, title: ad.title ?? "", company_name: ad.company?.name ?? ad.employer ?? "",
      url: `${AD_URL}${id}`, location: ad.workplace?.municipality ?? "Vetlanda", municipality: ad.workplace?.municipality ?? "Vetlanda",
      remote: false, language: "sv", description: ad.description ?? "", occupation: ad.occupation ?? "",
      deadline: ad.lastApplicationDate ? String(ad.lastApplicationDate).slice(0, 10) : null, employment_type: ad.workingHoursType ?? "Okänd",
      published_at: ad.publishedDate ?? null,
    } as LocalJob;
  });
}

/** Everything local, the way vetlandajobb loads it: Platsbanken (fallback if down) plus the kommun site, in parallel. */
export async function fetchLocal(): Promise<LocalJob[]> {
  const [pb, kommun] = await Promise.all([
    fetchVetlanda().catch(() => fetchPlatsbankenDirect()),
    fetchVetlandaSe().catch(() => [] as LocalJob[]),
  ]);
  const seen = new Set<string>();
  return [...pb, ...kommun].filter((j) => {
    const k = `${j.title}|${j.company_name}`.toLowerCase().trim();
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
