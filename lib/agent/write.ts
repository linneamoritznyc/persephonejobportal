/**
 * The application machine (03 s5 + s9): pick the branch CV by family, retrieve
 * the most relevant facts, write a gift-shaped cover letter (Sonnet, prompt
 * cached master profile), a short email and a LinkedIn note. Every text passes
 * the banned-terms guard and the style linter before it is saved.
 */
import { ask, askJson, SONNET, HAIKU, type CostMeter } from "../claude";
import { assertNoBannedTerms, lintStyle, tidy, BannedTermError } from "../guard";
import { embed, toPgVector } from "../embed";
import type { Ctx } from "./context";

export class GuardRejection extends Error {
  constructor(public what: string, public detail: string) {
    super(`${what}: ${detail}`);
  }
}

/** Simulation-only numbers that must never reach an employer. */
const SIMULATION = /28[,\s]?224|959\s*to\s*6[,\s]?603|6\.9x|\$?22[,\s]?000\s*(\/|a|per)\s*month|lead scoring for sem/i;
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
  if (SIMULATION.test(t)) throw new GuardRejection(what, "simulation numbers");
  const lint = lintStyle(t);
  if (lint.length) throw new GuardRejection(what, `style: ${lint.join(", ")}`);
  return t;
}

export function pickCv(ctx: Ctx, family: string | null, isBig: boolean, language: string | null, jobTitle?: string, country: "se" | "us" = "se"): string {
  const fam = family && /^[1-6]$/.test(family) ? family : "1";
  if (country === "us") return `${fam}U`;
  if (language === "sv") return `${fam}C`;
  if (fam === "5" && /product|engineer|builder/i.test(jobTitle ?? "")) return "5T";
  return `${fam}S`;
}

export const DEV_SITE = "linneamoritzdev.vercel.app";

/** Drops any preamble ("Here are two sentences...") and keeps at most 2 sentences. */
export function twoSentences(t: string): string {
  const lines = cleanOutgoing(t).split("\n").map((l) => l.trim()).filter((l) => l && !/^(here (are|is)|sure|below|sentence \d)/i.test(l) && !/:$/.test(l));
  const text = lines.join(" ").replace(/^["“]|["”]$/g, "");
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}
const PHONE = "0761166109";
const PHONE_INTL = "+46 76 116 61 09";

/** Outgoing text links only the dev site. */
export function portfolioFor(_ctx: Ctx, _family: string | null, _gift?: string | null) {
  return DEV_SITE;
}

/** Country decides the format: US companies get the US style, everything else the Swedish style. */
export function countryOf(job: any): "se" | "us" {
  return job.track === "us" || job.source?.startsWith?.("us:") ? "us" : "se";
}

/** Fixed email shells. Only the 1 to 2 middle sentences are written by the model. */
export function emailShell(o: { lang: "sv" | "en"; country: "se" | "us"; title: string; company: string; middle: string; local?: boolean }) {
  if (o.local)
    return `Hej!\n\nJag söker tjänsten som ${o.title.toLowerCase()} på ${o.company}.\n\nBifogat finner du mitt personliga brev och CV.\n\nMed vänliga hälsningar,\nLinnea Moritz\n${PHONE}`;
  if (o.lang === "sv")
    return `Hej,\n\nJag söker tjänsten som ${o.title} hos ${o.company}.\n\n${o.middle}\n\nBifogat finns mitt CV och personliga brev. Jag berättar gärna mer om hur jag kan bidra.\n\nMed vänliga hälsningar,\nLinnea Moritz\n${PHONE}\n${DEV_SITE}`;
  return `Hi,\n\nI'm applying for the ${o.title} role at ${o.company}.\n\n${o.middle}\n\nMy CV and cover letter are attached. I would be glad to talk about the role.\n\nBest regards,\nLinnea Moritz\n${o.country === "us" ? PHONE_INTL : PHONE}\n${DEV_SITE}`;
}

/** Claude Haiku picks the 6 facts that best prove fit for this exact role, from the full ledger. */
async function pickFacts(ctx: Ctx, job: any, meter?: CostMeter): Promise<string[]> {
  const ledger = ctx.facts.filter((f) => !f.id.startsWith("P-")).map((f) => `[${f.id}] ${f.text}`).join("\n");
  try {
    const r = await askJson<{ ids: string[] }>({
      model: HAIKU,
      maxTokens: 300,
      meter,
      system: 'Pick the 6 facts that best prove this candidate fits this exact role. Prefer direct, concrete evidence for the main requirements of the ad. Return JSON only: {"ids":["F-..."]}.',
      prompt: `ROLE: ${job.title} at ${job.company_name}\nAD:\n${(job.full_description ?? job.description ?? "").slice(0, 4000)}\n\nFACTS:\n${ledger}`,
    });
    return (r.ids ?? []).filter((id) => ctx.facts.some((f) => f.id === id)).slice(0, 6);
  } catch {
    return [];
  }
}

/** Second pass: finds sentences with claims the facts do not support. */
async function unsupportedSentences(text: string, facts: string, meter?: CostMeter): Promise<string[]> {
  try {
    const r = await askJson<{ unsupported: string[] }>({
      model: HAIKU,
      maxTokens: 500,
      meter,
      system: 'You check an application text against the candidate\'s fact list. List every sentence that claims something the facts do not support: invented numbers, money amounts, team sizes, mentoring, clients, employers, titles or results. Opinions about fit and plain statements of interest are fine. Return JSON only: {"unsupported":["exact sentence"]}.',
      prompt: `FACTS:\n${facts}\n\nTEXT:\n${text}`,
    });
    return (r.unsupported ?? []).filter((x) => typeof x === "string" && x.length > 8);
  } catch {
    return [];
  }
}

async function factChecked(gen: (feedback: string) => Promise<string>, what: string, facts: string, meter?: CostMeter): Promise<string> {
  let feedback = "";
  let text = "";
  for (let i = 0; i < 2; i++) {
    text = await writeChecked(() => gen(feedback), what);
    const bad = await unsupportedSentences(cleanOutgoing(text), facts, meter);
    if (!bad.length) return text;
    feedback = `Remove or rewrite these unsupported claims: ${bad.map((b) => `"${b}"`).join("; ")}`;
    if (i === 1) for (const b of bad) text = text.replace(b, "").replace(/\n{3,}/g, "\n\n");
  }
  return text;
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
        system: `Skriv ett personligt brev på naturlig svenska för Linnea Moritz till ett lokalt jobb i Vetlanda. 150 till 230 ord, 3 korta stycken. Börja med "Hej!" på egen rad och avsluta med "Med vänliga hälsningar,\nLinnea Moritz\n${PHONE}". Nämn arbetsgivaren och tjänsten, 2 konkreta saker från annonsen och 2 fakta från profilen som passar. Säg att hon bor i Vetlanda och kan börja direkt. Ange fakta-id inom hakparentes efter meningar som använder fakta. ${rules}`,
        prompt: `JOBB: ${job.title} hos ${job.company_name}, ${job.location ?? "Vetlanda"}.\nANSTÄLLNING: ${job.employment_type ?? ""}\nANNONS:\n${ad}${instruction ? `\n\nEXTRA: ${instruction}` : ""}`,
      }),
    "brev"
  );
  const factIds = extractFactIds(letter);
  const letterClean = cleanOutgoing(letter);
  const email = emailShell({ lang: "sv", country: "se", title: job.title, company: job.company_name, middle: "", local: true });
  return { letter: letterClean, email, subject: `Ansökan: ${job.title} – Linnea Moritz`, linkedin: "", factIds, cv: "L", portfolio: "" };
}

export async function writeApplication(ctx: Ctx, job: any, match: { primary_gift?: string | null; gift_read?: any; family_id?: string | null }, meter?: CostMeter, instruction?: string): Promise<Written> {
  if (job.mode === "local") return writeLocalApplication(ctx, job, meter, instruction);
  const family = match.family_id ?? job.family_id ?? null;
  const company = ctx.companies.find((c: any) => c.id === job.company_id || c.name === job.company_name);
  const cv = pickCv(ctx, family, !!company?.is_big_company, job.language, job.title, countryOf(job));
  const picked = await pickFacts(ctx, job, meter);
  const facts = picked.length ? picked.map((id) => ctx.facts.find((f) => f.id === id)!).map((f) => ({ id: f.id, text: f.text })) : await retrieveFacts(ctx, job, family);
  const factText = ctx.facts.map((f) => `[${f.id}] ${f.text}`).join("\n");
  const gr = match.gift_read ?? {};
  const gift = (id?: string) => ctx.gifts.find((g: any) => g.id === id);
  const g1 = gift(gr.primary_gift), g2 = gift(gr.secondary_gift);
  const portfolio = portfolioFor(ctx, family, gr.primary_gift);
  const feedback = ctx.rules.filter((r) => r.kind === "style" && r.name === "feedback").map((r) => `- ${r.rule}`).join("\n");

  const country = countryOf(job);
  const lang: "sv" | "en" = country === "se" && job.language === "sv" ? "sv" : "en";
  const brief = [
    `JOB: ${job.title} at ${job.company_name}, ${job.location ?? "Stockholm"}.`,
    `AD:\n${(job.full_description ?? job.description ?? "").slice(0, 6000)}`,
    `PRIMARY STRENGTH (write it in professional language only): ${g1 ? g1.professional_language.join(", ") : "solutions and building"}. The ad's words: ${(gr.gifts_called_for ?? []).map((x: any) => `"${x.evidence_in_ad}"`).join(", ")}`,
    `SECONDARY STRENGTH: ${g2 ? g2.professional_language.join(", ") : "shipping"}`,
    `USE THESE FACTS FIRST (the best proof for this role):\n${facts.map((f) => `[${f.id}] ${f.text}`).join("\n")}`,
    feedback ? `MY EARLIER EDITS (follow them):\n${feedback}` : "",
    instruction ? `EXTRA INSTRUCTION FROM ME: ${instruction}` : "",
  ].filter(Boolean).join("\n\n");

  const letter = await factChecked(
    (feedback) =>
      ask({
        model: SONNET,
        cached: ctx.master,
        meter,
        maxTokens: 1100,
        temperature: 0.5,
        system: [
          ...(country === "us"
            ? [
                "Write an English cover letter for Linnea Moritz to a US company. American style: short and punchy, 180 to 260 words, gets to results fast.",
                'Start with "Dear Hiring Team," on its own line. End with "Best regards,\nLinnea Moritz".',
                "Paragraph 1: the role and company by name and why her mix fits. Paragraph 2: the two strongest real results for this role, with numbers. Paragraph 3: one line on what she brings in addition, and that she is open to US remote work.",
              ]
            : [
                `Write a Swedish-style personligt brev for Linnea Moritz, in ${lang === "sv" ? "Swedish" : "English"}. Half a page: 170 to 240 words, 3 short paragraphs, personal voice, modest and factual. Let the facts speak.`,
                lang === "sv" ? 'Start with "Hej," on its own line. End with "Med vänliga hälsningar,\nLinnea".' : 'Start with "Hi," on its own line. End with "Kind regards,\nLinnea".',
                "Paragraph 1: why she is applying to this company and this role, using something specific from the ad. Paragraph 2: how her experience matches, with one or two real results. Paragraph 3: who she is as a person (fine artist with eight years in tech, creativity and data) and that she is moving to Stockholm for a full-time role.",
                "The letter adds to the CV instead of repeating it. No 30-day plans, no hard sell.",
              ]),
          "Her own projects (Kompetensgrafen, the municipal budget tool, JobbaJobba, NordiqFlow, Vetlandajobb, Anti-Apathy) are her own projects. Never describe them as client work or as done for a municipality.",
          "Use only facts from the master profile. Every number must come from a fact. After each sentence that uses a fact, append its id in square brackets, like [F-FH-VOICE].",
          "Plain direct English, subject-verb-object, short sentences. No em dashes. Never use the phrases: not just, rather than, isn't, instead of. No contrast framing. No filler. Never write the internal strength names.",
        ].join("\n"),
        prompt: feedback ? `${brief}\n\nFIX: ${feedback}` : brief,
      }),
    "cover letter",
    factText,
    meter
  );
  const factIds = extractFactIds(letter);
  const letterClean = cleanOutgoing(letter);

  const middleRaw = await factChecked(
    (feedback) =>
      ask({
        model: SONNET,
        cached: ctx.master,
        meter,
        maxTokens: 200,
        system: `Return only 2 sentences, nothing else, in ${lang === "sv" ? "Swedish" : "English"}, for the middle of an application email. At most 45 words in total. Sentence 1: what she builds that matters for this role, starting with "${lang === "sv" ? "Jag bygger" : "I build"}". Sentence 2: her most recent real proof for it, from the USE THESE FACTS FIRST list, with its number. No greeting, no sign-off, no links, no fact ids. Never describe her own projects as client work. No em dashes.`,
        prompt: feedback ? `${brief}\n\nFIX: ${feedback}` : brief,
      }),
    "email",
    factText,
    meter
  );
  const middle = twoSentences(middleRaw);
  const email = emailShell({ lang, country, title: job.title, company: job.company_name, middle });
  const subjectLine = lang === "sv" ? `Ansökan: ${job.title} – Linnea Moritz` : `${job.title} – Linnea Moritz`;

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

  return { letter: letterClean, email, subject: subjectLine, linkedin, factIds, cv, portfolio };
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
      { application_id: appId, kind: "email", subject: w.subject, body: w.email, fact_ids: w.factIds, cv_code: w.cv, updated_at: now, edited_by_me: false, gmail_drafted_at: null, gmail_draft_uid: null },
      ...(w.linkedin ? [{ application_id: appId, kind: "linkedin_note", subject: null, body: w.linkedin, fact_ids: [], cv_code: w.cv, updated_at: now, edited_by_me: false }] : []),
    ],
    { onConflict: "application_id,kind" }
  );
  await ctx.sb.from("ps_events").insert({ kind: "drafted", job_id: jobId, application_id: appId, detail: { cv: w.cv, facts: w.factIds } });
  return appId;
}
