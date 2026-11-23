/**
 * The application machine (03 s5 + s9): pick the branch CV by family, retrieve
 * the most relevant facts, write a gift-shaped cover letter (Sonnet, prompt
 * cached master profile), a short email and a LinkedIn note. Every text passes
 * the banned-terms guard and the style linter before it is saved.
 */
import { ask, SONNET, type CostMeter } from "../claude";
import { assertNoBannedTerms, lintStyle, tidy, BannedTermError } from "../guard";
import { embed, toPgVector } from "../embed";
import type { Ctx } from "./context";

export class GuardRejection extends Error {
  constructor(public what: string, public detail: string) {
    super(`${what}: ${detail}`);
  }
}

const SPIRITUAL = /\b(spiritual|gift(s|ed)?|calling|anointed|bezalel)\b/i;

/** Removes fact-id tags and any leading "Subject:" line the model may add. */
export function cleanOutgoing(text: string): string {
  return text
    .replace(/^\s*(subject|ämne)\s*:.*\n+/i, "")
    .replace(/\s*\[((?:F|L|S|P)-[A-Za-z0-9_-]+)(,\s*(?:F|L|S|P)-[A-Za-z0-9_-]+)*\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function extractFactIds(text: string): string[] {
  return [...new Set([...text.matchAll(/\b((?:F|L|S)-[A-Za-z0-9_-]+)\b/g)].map((m) => m[1]).filter((id) => /\d|[A-Z]{2}/.test(id)))];
}

export function checkOutgoing(text: string, what: string): string {
  const t = tidy(what === "cover letter" || what === "brev" ? text : cleanOutgoing(text));
  try {
    assertNoBannedTerms(t);
  } catch (e) {
    if (e instanceof BannedTermError) throw new GuardRejection(what, "banned term");
    throw e;
  }
  if (SPIRITUAL.test(t)) throw new GuardRejection(what, "internal vocabulary in outgoing text");
  const lint = lintStyle(t);
  if (lint.length) throw new GuardRejection(what, `style: ${lint.join(", ")}`);
  return t;
}

export function pickCv(ctx: Ctx, family: string | null, isBig: boolean, language: string | null, jobTitle?: string): string {
  const fam = family && /^[1-6]$/.test(family) ? family : "1";
  if (fam === "5" && /product|engineer|builder/i.test(jobTitle ?? "")) return "5T";
  // Startup register in English by default; Swedish corporate only for Swedish-language ads at big companies.
  return isBig && language === "sv" ? `${fam}C` : `${fam}S`;
}

export function portfolioFor(ctx: Ctx, family: string | null, gift?: string | null) {
  const urls = ctx.profile?.portfolio_urls ?? {};
  const engineering = family === "1" || family === "5";
  const base = engineering ? urls.engineering ?? "https://linneamoritzdev.vercel.app" : urls.creative ?? "https://persephonejobportal.vercel.app/";
  return engineering || !gift ? base : `${base.replace(/\/$/, "")}/?lens=${gift}`;
}

async function retrieveFacts(ctx: Ctx, job: any, family: string | null): Promise<{ id: string; text: string }[]> {
  const q = toPgVector(embed(`${job.title} ${job.company_name} ${(job.description ?? "").slice(0, 2000)}`));
  const { data } = await ctx.sb.rpc("ps_match_facts", { query_embedding: q, match_count: 14, family });
  const legacyFree = (data ?? []).filter((f: any) => !String(f.id).startsWith("L-") && !String(f.id).startsWith("P-"));
  const strong = ctx.facts.filter((f) => f.strength >= 5 && (!family || f.role_families.includes(family)));
  const merged = [...legacyFree, ...strong].filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i);
  return merged.slice(0, 12).map((f: any) => ({ id: f.id, text: f.text }));
}

async function writeChecked(gen: () => Promise<string>, what: string, tries = 3): Promise<string> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return checkOutgoing(await gen(), what);
    } catch (e) {
      last = e;
      if (!(e instanceof GuardRejection)) throw e;
    }
  }
  throw last;
}

export interface Written {
  letter: string;
  email: string;
  subject: string;
  linkedin: string;
  factIds: string[];
  cv: string;
  portfolio: string;
}

/** Local mode: a short Swedish letter and email for an in-person job in Vetlanda, with the Swedish CV (L). */
export async function writeLocalApplication(ctx: Ctx, job: any, meter?: CostMeter, instruction?: string): Promise<Written> {
  const ad = (job.full_description ?? job.description ?? "").slice(0, 5000);
  const rules = "Ren text utan markdown. Inga tankstreck (—). Inga överdrifter. Använd bara fakta från profilen och skriv aldrig att hon talar norska eller danska. Skriv som en riktig person.";
  const letter = await writeChecked(
    () =>
      ask({
        model: SONNET, cached: ctx.masterLocal, meter, maxTokens: 900, temperature: 0.5,
        system: `Skriv ett personligt brev på naturlig svenska för Linnea Moritz till ett lokalt jobb i Vetlanda. 150 till 230 ord, 3 korta stycken, ingen hälsningsfras överst och inget namnblock. Nämn arbetsgivaren och tjänsten, 2 konkreta saker från annonsen och 2 fakta från profilen som passar. Säg att hon bor i Vetlanda och kan börja direkt. Ange fakta-id inom hakparentes efter meningar som använder fakta. ${rules}`,
        prompt: `JOBB: ${job.title} hos ${job.company_name}, ${job.location ?? "Vetlanda"}.\nANSTÄLLNING: ${job.employment_type ?? ""}\nANNONS:\n${ad}${instruction ? `\n\nEXTRA: ${instruction}` : ""}`,
      }),
    "brev"
  );
  const factIds = extractFactIds(letter);
  const letterClean = cleanOutgoing(letter);
  const email = await writeChecked(
    () =>
      ask({
        model: SONNET, cached: ctx.masterLocal, meter, maxTokens: 300,
        system: `Skriv ett kort ansökningsmejl på svenska, under 70 ord: vilken tjänst, en mening om varför hon passar, att CV och personligt brev är bifogade, och att hon kan börja direkt. Avsluta med "Vänliga hälsningar, Linnea Moritz". ${rules}`,
        prompt: `${job.title} hos ${job.company_name}`,
      }),
    "mejl"
  );
  return { letter: letterClean, email, subject: `Ansökan: ${job.title} - Linnea Moritz`, linkedin: "", factIds, cv: "L", portfolio: "" };
}

export async function writeApplication(ctx: Ctx, job: any, match: { primary_gift?: string | null; gift_read?: any; family_id?: string | null }, meter?: CostMeter, instruction?: string): Promise<Written> {
  if (job.mode === "local") return writeLocalApplication(ctx, job, meter, instruction);
  const family = match.family_id ?? job.family_id ?? null;
  const company = ctx.companies.find((c: any) => c.id === job.company_id || c.name === job.company_name);
  const cv = pickCv(ctx, family, !!company?.is_big_company, job.language, job.title);
  const facts = await retrieveFacts(ctx, job, family);
  const gr = match.gift_read ?? {};
  const gift = (id?: string) => ctx.gifts.find((g: any) => g.id === id);
  const g1 = gift(gr.primary_gift), g2 = gift(gr.secondary_gift);
  const portfolio = portfolioFor(ctx, family, gr.primary_gift);
  const feedback = ctx.rules.filter((r) => r.kind === "style" && r.name === "feedback").map((r) => `- ${r.rule}`).join("\n");

  const brief = [
    `JOB: ${job.title} at ${job.company_name}, ${job.location ?? "Stockholm"}.`,
    `AD:\n${(job.full_description ?? job.description ?? "").slice(0, 6000)}`,
    `PRIMARY STRENGTH (write it in professional language only): ${g1 ? g1.professional_language.join(", ") : "solutions and building"}. The ad's words: ${(gr.gifts_called_for ?? []).map((x: any) => `"${x.evidence_in_ad}"`).join(", ")}`,
    `SECONDARY STRENGTH: ${g2 ? g2.professional_language.join(", ") : "shipping"}`,
    `MOST RELEVANT FACTS FOR THIS JOB: ${facts.map((f) => f.id).join(", ")}`,
    feedback ? `MY EARLIER EDITS (follow them):\n${feedback}` : "",
    instruction ? `EXTRA INSTRUCTION FROM ME: ${instruction}` : "",
  ].filter(Boolean).join("\n\n");

  const letter = await writeChecked(
    () =>
      ask({
        model: SONNET,
        cached: ctx.master,
        meter,
        maxTokens: 1100,
        temperature: 0.5,
        system: [
          "Write an English cover letter for Linnea Moritz. 230 to 320 words, four short paragraphs, no greeting line, no sign-off name block.",
          "Structure: 1) opening line: the primary strength in professional language, tied to the company's own words from the ad. 2) proof: the two strongest facts for it, with their numbers. 3) bridge: the secondary strength with one fact. 4) close: one specific thing she would build or fix for them in the first 30 days, and that she wants a full-time role in Stockholm.",
          "Pitch shape: she sees what others miss, builds the fix end to end, and brings people in to use it.",
          "Use only facts from the master profile. Every number must come from a fact. After each sentence that uses a fact, append its id in square brackets, like [F-FH-VOICE].",
          "Plain direct English, subject-verb-object, short sentences. No em dashes. Never use the phrases: not just, rather than, isn't, instead of. No contrast framing. No filler. Never write the internal strength names.",
        ].join("\n"),
        prompt: brief,
      }),
    "cover letter"
  );
  const factIds = extractFactIds(letter);
  const letterClean = cleanOutgoing(letter);

  const email = await writeChecked(
    () =>
      ask({
        model: SONNET,
        cached: ctx.master,
        meter,
        maxTokens: 400,
        system: "Write a short application email, under 90 words, English. One sentence on the strongest proof with its number, one line that the CV and cover letter are attached, the portfolio link once, and one ask. Sign off 'Linnea Moritz'. No em dashes. Never use: not just, rather than, isn't, instead of.",
        prompt: `${brief}\n\nPortfolio link: ${portfolio}`,
      }),
    "email"
  );

  const template = ctx.rules.find((r) => r.kind === "template" && r.name === "linkedin_hiring_team")?.rule ?? "";
  const linkedin = await writeChecked(
    async () => {
      const t = await ask({
        model: SONNET,
        cached: ctx.master,
        meter,
        maxTokens: 300,
        system: `Write a LinkedIn note to someone on the hiring team, 50 to 70 words (hard limit 80), one link, one ask (a question about their team). One sentence of evidence for the primary strength. Use {name} as the placeholder for their first name. Base it on this template, adapted to the role:\n${template}\nUse this link: ${ctx.profile?.loom_url || portfolio}. No em dashes.`,
        prompt: brief,
      });
      const words = t.trim().split(/\s+/).length;
      if (words > 80) throw new GuardRejection("linkedin note", `${words} words`);
      return t;
    },
    "linkedin note"
  );

  return { letter: letterClean, email, subject: `${job.title} - Linnea Moritz`, linkedin, factIds, cv, portfolio };
}

/** Saves the written texts as ps_drafts rows (one per kind) and returns the application id. */
export async function saveWritten(ctx: Ctx, jobId: string, w: Written) {
  const { data: app } = await ctx.sb
    .from("ps_applications")
    .upsert({ job_id: jobId, status: "drafted", cv_version: w.cv, stage_changed_at: new Date().toISOString(), next_action: "Open the Gmail draft, check it, send it" }, { onConflict: "job_id" })
    .select("id")
    .single();
  const appId = app!.id as string;
  const now = new Date().toISOString();
  await ctx.sb.from("ps_drafts").upsert(
    [
      { application_id: appId, kind: "cover_letter", subject: w.subject, body: w.letter, fact_ids: w.factIds, cv_code: w.cv, updated_at: now, edited_by_me: false },
      { application_id: appId, kind: "email", subject: w.subject, body: w.email, fact_ids: w.factIds, cv_code: w.cv, updated_at: now, edited_by_me: false },
      ...(w.linkedin ? [{ application_id: appId, kind: "linkedin_note", subject: null, body: w.linkedin, fact_ids: [], cv_code: w.cv, updated_at: now, edited_by_me: false }] : []),
    ],
    { onConflict: "application_id,kind" }
  );
  await ctx.sb.from("ps_events").insert({ kind: "drafted", job_id: jobId, application_id: appId, detail: { cv: w.cv, facts: w.factIds } });
  return appId;
}
