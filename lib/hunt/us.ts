/** AI mode, US track: AI consulting and automation roles on US remote boards. */
import type { RawJob } from "../dedupe";
import { stripHtml, parseRss } from "./careers";

const UA = { "user-agent": "Persephone/1.0 (personal job search)" };
const AI = /\b(ai|llm|gpt|claude|genai|generative|automation|agent|machine learning)\b/i;
const CONSULT = /\b(consult|solutions?|implementation|advisor|architect|strategist|engineer|specialist)\b/i;

export async function fetchUsConsulting(): Promise<(RawJob & { mode: "ai" })[]> {
  const out: (RawJob & { mode: "ai" })[] = [];
  for (const q of ["AI consultant", "AI automation", "AI solutions", "LLM consultant", "generative AI"]) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=40`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs ?? []) {
        const geo = String(j.candidate_required_location ?? "");
        if (geo && !/usa|us\b|united states|americas|north america|worldwide|anywhere/i.test(geo)) continue;
        out.push({
          mode: "ai", source: "us:remotive", external_id: String(j.id), title: j.title, company_name: j.company_name, url: j.url,
          location: geo || "Remote (US)", remote: true, language: "en", description: stripHtml(j.description ?? ""),
          salary_currency: "USD", employment_type: String(j.job_type ?? "").replace("_", " ") || "Unknown", published_at: j.publication_date ?? null,
          raw: { salary: j.salary },
        });
      }
    } catch {}
  }
  try {
    const res = await fetch("https://weworkremotely.com/categories/remote-programming-jobs.rss", { headers: UA, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (res.ok)
      for (const it of parseRss(await res.text())) {
        const [company, ...rest] = it.title.split(":");
        out.push({ mode: "ai", source: "us:wwr", external_id: it.guid || it.link, title: rest.join(":").trim() || it.title, company_name: rest.length ? company.trim() : "", url: it.link, location: it.location || "Remote", remote: true, language: "en", description: stripHtml(it.description), salary_currency: "USD", employment_type: "Unknown" });
      }
  } catch {}
  return out.filter((j) => AI.test(`${j.title} ${j.description.slice(0, 800)}`) && CONSULT.test(j.title));
}
