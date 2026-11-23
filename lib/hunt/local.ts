/** Local mode: every current ad in Vetlanda kommun from Platsbanken (all employment types). */
import type { RawJob } from "../dedupe";

export const VETLANDA = "xJqx_SLC_415";
const AD_URL = "https://arbetsformedlingen.se/platsbanken/annonser/";

export async function fetchVetlanda(): Promise<(RawJob & { mode: "local" })[]> {
  const out: (RawJob & { mode: "local" })[] = [];
  for (let offset = 0; offset < 600; offset += 100) {
    const qs = new URLSearchParams({ municipality: VETLANDA, limit: "100", offset: String(offset), sort: "pubdate-desc" });
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
