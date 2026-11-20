/** Paste any job URL: fetch the page and extract the posting with Claude Haiku (the Anti-Apathy flow). */
import { askJson, HAIKU } from "../claude";
import { stripHtml } from "./careers";
import { NON_PERMANENT } from "../guard";

export async function scrapeJobUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error("Paste a full https:// link");
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Persephone personal job search)" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`The page answered HTTP ${res.status}`);
  const html = await res.text();
  const ld = [...html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n").slice(0, 8000);
  const text = stripHtml(html.replace(/<(script|style|nav|footer)[\s\S]*?<\/\1>/gi, " ")).slice(0, 12000);
  const j = await askJson<{ title: string; company_name: string; location: string; employment_type: string; description: string; deadline: string | null; language: "en" | "sv" }>({
    model: HAIKU,
    maxTokens: 2500,
    system: 'Extract the job posting. JSON only: {"title":"","company_name":"","location":"","employment_type":"Permanent, full-time | Contract | Part-time | Unknown","description":"the full ad text, plain","deadline":"YYYY-MM-DD or null","language":"en|sv"}',
    prompt: `URL: ${url}\n\nJSON-LD:\n${ld}\n\nPAGE TEXT:\n${text}`,
  });
  if (!j.title) throw new Error("Could not find a job on that page");
  if (NON_PERMANENT.test(`${j.employment_type} ${j.title}`) && !/permanent/i.test(j.employment_type)) throw new Error(`Skipped: ${j.employment_type}. Persephone keeps permanent full-time roles only.`);
  return j;
}
