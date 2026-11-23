/**
 * Seeds Persephone (idempotent). Run: npx tsx scripts/seed.ts
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
 * Also imports the legacy profile tables from the same database, tagged "legacy".
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as P from "../lib/seed/profile";
import { embed, toPgVector } from "../lib/embed";
import { findBannedTerm, lintStyle, tidy, BLOCKED_COMPANIES } from "../lib/guard";
import { buildCv, branchCode, REGISTERS } from "../lib/cv";
import { renderCv } from "../lib/pdf";
import { calculateFitScore, type Importance } from "../lib/score/crosstrees";
import { normalizeSkill } from "../lib/match";
import occupations from "./data/occupations_seed.json";
import edges from "./data/substitutability_seed.json";
import escoSkills from "./data/skills_seed.json";
import * as GX from "../lib/seed/graph";
import { LOCAL_FACTS, LOCAL_CV } from "../lib/seed/local";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ai = new Anthropic();
const only = process.argv[2];

function must<T>(r: { data: T; error: any }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}
function clean(text: string, where: string) {
  const b = findBannedTerm(text);
  if (b) throw new Error(`Banned term in ${where}`);
  return text;
}

async function profile() {
  const p = P.PROFILE;
  must(await sb.from("ps_profile").upsert({
    id: 1, name: p.name, headline: p.headline, location: p.location, email: p.email, website: p.website,
    linkedin: p.linkedin, github: p.github, languages: p.languages, salary_min_sek: p.salary_min_sek,
    salary_max_sek: p.salary_max_sek, us_contract_floor_usd: null, start_date: p.start_date, summary: p.summary,
    prefers_big_company: true, portfolio_urls: p.portfolio_urls, salary_answer: p.salary_answer,
    stability_answer: p.stability_answer, salary_target_sek: p.salary_target_sek, salary_targets: p.salary_targets, thread: p.thread, thread_professional: p.thread_professional,
    recruiter_email: p.email, regions: p.regions, updated_at: new Date().toISOString(),
  }), "profile");
}

async function experiencesAndFacts() {
  // Remove previous non-legacy seed rows, then insert fresh.
  must(await sb.from("ps_facts").delete().not("tags", "cs", "{legacy}"), "clear facts");
  must(await sb.from("ps_experiences").delete().not("categories", "cs", "{legacy}"), "clear exps");
  const idByKey: Record<string, string> = {};
  for (const e of P.EXPERIENCES) {
    const card = P.PORTFOLIO_CARDS.find((c) => c.key === e.key);
    const row = must(await sb.from("ps_experiences").insert({
      org: clean(e.org, e.key), title: clean(e.title, e.key), start_date: e.start_date, end_date: e.end_date,
      dates_label: e.dates_label, location: e.location ?? null, employment_type: e.employment_type ?? null,
      summary: e.summary, bullets: e.bullets.map((b) => clean(b, e.key)), kind: e.kind, sort: e.sort,
      group_header: e.group_header ?? null, url: card?.url ?? e.url ?? null, cv_versions: e.cv_versions ?? ["startup", "corporate"],
      categories: [e.key], source_file: "02-update.md / technical CV / portfolio",
      show_on_portfolio: !!card, art_seed: card?.seed ?? null, portfolio_order: card?.order ?? null,
      saw: card?.saw ?? null, built: card?.built ?? null, reached: card?.reached ?? null, filter: card?.filter ?? null,
      card_title: card?.title ?? null, card_kind: card?.kind ?? null, portfolio_tags: card?.tags ?? [], gift_ids: card?.gifts ?? [],
    }).select("id").single(), `exp ${e.key}`) as { id: string };
    idByKey[e.key] = row.id;
  }
  const rows = P.FACTS.map((f) => ({
    id: f.id, text: clean(f.text, f.id), numbers: f.numbers ?? {}, experience_id: f.exp ? idByKey[f.exp] : null,
    tags: f.tags, role_families: f.fam.map(String), strength: f.strength, source_file: f.src,
    embedding: toPgVector(embed(f.text + " " + f.tags.join(" "))),
  }));
  must(await sb.from("ps_facts").upsert(rows), "facts");
  // Portfolio stats, people band and timeline as editable facts.
  const pf = [
    { id: "P-STAT-1", text: "28,224|high-intent users found that ads never learned from", tags: ["portfolio", "stat"] },
    { id: "P-STAT-2", text: "11|production web apps shipped in 2 months", tags: ["portfolio", "stat"] },
    { id: "P-STAT-3", text: "2,000+|applicants guided in 40+ countries", tags: ["portfolio", "stat"] },
    { id: "P-STAT-4", text: "39|art exhibitions in 21 cities", tags: ["portfolio", "stat"] },
    { id: "P-PEOPLE-1", text: "2,000+|applicants guided one by one, in 40+ countries", tags: ["portfolio", "people"] },
    { id: "P-PEOPLE-2", text: "196|Nordic schools in my outreach CRM", tags: ["portfolio", "people"] },
    { id: "P-PEOPLE-3", text: "45|students mentored through capstone projects", tags: ["portfolio", "people"] },
    { id: "P-PEOPLE-4", text: "120,000 kr|raised at 15 for women's education in Ethiopia", tags: ["portfolio", "people"] },
    { id: "P-TIME-01", text: "2026 to now|Soil Food Web Foundation|Contractor: digital, content and grants", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-02", text: "Feb to Apr 2026|The Financial Healer and PrePartum|Product and technical lead", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-03", text: "2024 to 2026|Minerva University|Alumni Ambassador, Western Europe", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-04", text: "2022 to 2023|Keeping Tabs, New York|Multimedia Technical Specialist", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-05", text: "2021 to 2022|Clubhouse, YouTube, TikTok|Trust & Safety: sole reviewer for Scandinavia, all 16 harm categories", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-06", text: "2021|Swedish-American Chamber of Commerce|Grew the community 20%", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-07", text: "2019 to 2020|Minerva Project|Guided 2,000+ applicants in 40+ countries", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-08", text: "2018 to 2019|Google Ads, gTech|Swedish Content Analyst, 100+ ads a day, 100% of SLA targets", tags: ["portfolio", "timeline"] },
    { id: "P-TIME-09", text: "2019|Global Startup Weekend Stockholm|First prize", tags: ["portfolio", "timeline"] },
  ].map((r) => ({ ...r, role_families: [], strength: 1, source_file: "portfolio/index.html", numbers: {} }));
  must(await sb.from("ps_facts").upsert(pf), "portfolio facts");
  return idByKey;
}

async function skills() {
  const rows = P.SKILLS.map((s) => ({
    name: s.name, aliases: P.SKILL_ALIASES[s.name] ?? [], category: s.category, level: s.level,
    role_families: s.fam.map(String),
    evidence_fact_ids: P.FACTS.filter((f) => f.text.toLowerCase().includes(s.name.toLowerCase().split(" ")[0])).map((f) => f.id).slice(0, 5),
  }));
  must(await sb.from("ps_skills").upsert(rows, { onConflict: "name" }), "skills");
  must(await sb.from("ps_skills").upsert(P.LEARNING_TARGETS.map((l) => ({ name: l.name, category: "learning target", level: 1, learning_target: true, gap_note: l.gap_note, role_families: ["5"] })), { onConflict: "name" }), "learning targets");
}

async function gifts() {
  must(await sb.from("ps_gifts").upsert(P.GIFTS.map((g) => ({
    id: g.id, sort: g.sort, name: g.name, essence: g.essence, evidence: g.evidence, professional_language: g.pro,
    role_families: g.fam, rare: g.rare,
  }))), "gifts");
}

async function stories() {
  must(await sb.from("ps_stories").delete().not("tags", "cs", "{legacy}"), "clear stories");
  const rows = P.STORIES.map((s) => {
    const spoken = `${s.situation} ${s.action} ${s.result}`;
    [s.title, spoken].forEach((t) => clean(t, s.title));
    return {
      title: s.title, pro_title: s.title, situation: s.situation, action: s.action, result: s.result, number: s.number,
      fact_ids: s.facts, tags: ["seed"], role_families: s.fam.map(String), gift_id: s.gift, spoken_60s: spoken,
    };
  });
  const ins = must(await sb.from("ps_stories").insert(rows).select("id,gift_id"), "stories") as { id: string; gift_id: string }[];
  must(await sb.from("ps_stories").delete().contains("tags", ["internal"]), "clear internal");
  must(await sb.from("ps_stories").insert(P.INTERNAL_PREP.map((x) => ({ title: x.title, notes: x.notes, tags: ["internal"], fact_ids: [] }))), "internal prep");
  for (const g of P.GIFTS) {
    const ids = ins.filter((r) => r.gift_id === g.id).map((r) => r.id);
    await sb.from("ps_gifts").update({ story_ids: ids }).eq("id", g.id);
  }
}

async function rules() {
  must(await sb.from("ps_writing_rules").delete().gte("id", 0), "clear rules");
  // banned-terms-list: the guard module holds the list; rules rows mirror it for the UI.
  const { BANNED_TERMS } = await import("../lib/guard");
  const rows = [
    ...P.WRITING_RULES.map((r, i) => ({ kind: r.kind, name: (r as any).name ?? null, rule: r.rule, sort: i })),
    ...BANNED_TERMS.map((t, i) => ({ kind: "banned_term", name: null, rule: t, sort: 100 + i })),
  ];
  must(await sb.from("ps_writing_rules").insert(rows), "rules");
}

async function families() {
  // CV rows first (families reference them)
  must(await sb.from("ps_role_families").upsert(P.ROLE_FAMILIES.map((f) => ({
    id: f.id, name: f.name, keywords_en: f.en, keywords_sv: f.sv, priority: f.priority, big_company_bonus: 10, cv_version: null,
  }))), "families");
}

async function companies() {
  const rows = [
    ...P.COMPANIES.map((c) => ({
      name: c.name, size: c.size, is_big_company: c.big, ats: c.ats, feed_url: c.feed, careers_url: c.careers,
      blocked: false, track: "stockholm", contact_name: (c as any).contact_name ?? null, contact_email: (c as any).contact_email ?? null, title_filter: (c as any).title_filter ?? null,
    })),
    ...BLOCKED_COMPANIES.map((n) => ({ name: n, size: null, is_big_company: false, ats: "other", feed_url: null, careers_url: null, blocked: true, track: "stockholm", contact_name: null, contact_email: null, title_filter: null })),
  ];
  must(await sb.from("ps_companies").upsert(rows, { onConflict: "name" }), "companies");
  must(await sb.from("ps_sources").upsert([
    { id: "jobtech", name: "Platsbanken (JobTech JobSearch)", kind: "jobtech", enabled: true, track: "stockholm" },
    { id: "careers", name: "Company career pages (Ashby, Lever, Greenhouse, Teamtailor)", kind: "company", enabled: true, track: "stockholm" },
    { id: "discovery", name: "Kompetensgrafen discovery terms", kind: "discovery", enabled: true, track: "stockholm" },
  ]), "sources");
}

async function graph() {
  must(await sb.from("ps_occupations").upsert((occupations as any[]).map((o) => ({
    id: o.id, name: o.name, ssyk_code: o.ssyk_code, definition: o.definition, workplace_model: o.workplace_model, source: "crosstrees_seed",
  }))), "occupations");
  const e = (edges as any[]).filter((x) => [25, 50, 75].includes(x.score)).map((x) => ({ source_id: x.source_id, target_id: x.target_id, score: x.score, direction: x.direction, source: "crosstrees_seed" }));
  const seen = new Set<string>();
  must(await sb.from("ps_occupation_edges").upsert(e.filter((x) => (seen.has(x.source_id + x.target_id) ? false : (seen.add(x.source_id + x.target_id), true))), { onConflict: "source_id,target_id" }), "edges");
  must(await sb.from("ps_skills_esco").upsert((escoSkills as any[]).map((s) => ({ id: s.id, name: s.name, alt_labels: s.alt_labels ?? [], esco_uri: s.esco_uri }))), "esco skills");
  // Extension around Linnea's profile
  must(await sb.from("ps_occupations").upsert(GX.OCCUPATIONS.map((o) => ({
    id: o.id, name: o.name, alt_titles: o.alt, gift_id: o.gift ?? null, is_seed: GX.SEED_OCCUPATIONS.includes(o.id), source: "persephone_curated",
  }))), "occupations ext");
  const skillIds = new Map<string, string>();
  for (const o of GX.OCCUPATIONS) for (const k of o.skills) skillIds.set(k.s, "px-" + k.s.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  must(await sb.from("ps_skills_esco").upsert([...skillIds].map(([name, id]) => ({ id, name, alt_labels: [], esco_uri: null }))), "ext skills");
  must(await sb.from("ps_occupation_skills").upsert(GX.OCCUPATIONS.flatMap((o) => o.skills.map((k) => ({ occupation_id: o.id, skill_id: skillIds.get(k.s)!, importance: k.imp ?? "required" })))), "occ skills");
  must(await sb.from("ps_occupation_edges").upsert(GX.EDGES.map(([a, b, sc]) => ({ source_id: a, target_id: b, score: sc, direction: "can_become", source: "persephone_curated" })), { onConflict: "source_id,target_id" }), "ext edges");
}

async function targets() {
  const { data: comps } = await sb.from("ps_companies").select("id,name,is_big_company");
  const byName = new Map((comps ?? []).map((c: any) => [c.name, c]));
  for (const t of P.TARGETS) {
    const c: any = byName.get(t.company);
    const external_id = `${t.company}:${t.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const job = must(await sb.from("ps_jobs").upsert({
      source: "target", external_id, company_id: c?.id ?? null, company_name: t.company, title: t.title,
      url: t.url ?? (c ? (P.COMPANIES.find((x) => x.name === t.company)?.careers ?? null) : null), location: "Stockholm",
      remote: false, language: "en", status: t.status, wave: t.wave, family_id: String(t.fam),
      deadline: t.deadline ?? null, is_open: t.status !== "closed", employment_type: "Permanent, full-time",
      description: `${t.title} at ${t.company}, Stockholm. Target role from the 10-day plan (wave ${t.wave}).`,
      track: "stockholm", dedupe_key: external_id,
    }, { onConflict: "source,external_id" }).select("id").single(), `target ${t.title}`) as { id: string };
    if (t.vetlanda != null) {
      must(await sb.from("ps_matches").upsert({
        job_id: job.id, method: "vetlandajobb_v1", score: t.vetlanda, family_id: String(t.fam),
        tier: t.vetlanda > 85 ? "direct" : "bridge", rank_score: t.vetlanda,
        why: "Known vetlandajobb scoreJob result.",
      }, { onConflict: "job_id,method" }), "vetlanda match");
    }
  }
  // Aarke automation draft cleanup: delete any draft for the closed role.
  const { data: closed } = await sb.from("ps_jobs").select("id").eq("company_name", "Aarke").eq("status", "closed");
  for (const j of closed ?? []) {
    const { data: apps } = await sb.from("ps_applications").select("id").eq("job_id", j.id);
    for (const a of apps ?? []) await sb.from("ps_drafts").delete().eq("application_id", a.id);
  }
}

async function plan() {
  must(await sb.from("ps_events").delete().eq("kind", "plan"), "clear plan");
  must(await sb.from("ps_events").insert(P.PLAN.map((d) => ({
    kind: "plan", title: `Day ${d.day}: ${d.title}`, due_date: d.date, detail: { day: d.day, done_when: d.done_when },
  }))), "plan");
}

async function translateSv(texts: string[]): Promise<string[]> {
  const res = await ai.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 8000,
    temperature: 0,
    system: "You translate CV text from English to natural professional Swedish. Translate only. Keep every number, name, product and date exactly. Keep company and product names in their original form. No em dashes. Return a JSON array of strings in the same order and length.",
    messages: [{ role: "user", content: JSON.stringify(texts) }],
  });
  const t = res.content.map((b: any) => b.text ?? "").join("");
  const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error("translation length mismatch");
  return arr.map((s: string) => tidy(s));
}

async function cvs() {
  const rows: any[] = [];
  for (const base of P.CV_BASES) {
    rows.push({ code: base.code, name: base.name, lead_line: base.lead, fact_ids: base.proof, role_families: base.fams.map(String), register: "master", base: base.code, frozen: true });
  }
  must(await sb.from("ps_cv_versions").upsert(rows), "cv bases");
  for (const fam of [1, 2, 3, 4, 5, 6]) {
    for (const reg of REGISTERS) {
      const code = branchCode(fam, reg);
      const built = buildCv(fam, reg);
      let input = built.input;
      if (reg === "corporate") {
        const flat = [input.summary, ...input.experiences.flatMap((e) => [e.title, e.dates, ...(e.bullets)]), ...input.education, ...input.extras];
        const sv = await translateSv(flat);
        let i = 0;
        input = {
          ...input,
          summary: sv[i++],
          experiences: input.experiences.map((e) => ({ ...e, title: sv[i++], dates: sv[i++], bullets: e.bullets.map(() => sv[i++]) })),
          education: input.education.map(() => sv[i++]),
          extras: input.extras.map(() => sv[i++]),
          languages: "Svenska (modersmål), engelska (modersmål), mandarin (HSK 3)",
          labels: { experience: "Erfarenhet", skills: "Kompetenser", education: "Utbildning", languages: "Språk", also: "Projekt och mer" },
        };
      }
      const all = JSON.stringify(input);
      const banned = findBannedTerm(all);
      if (banned) throw new Error(`Banned term in CV ${code}`);
      const pdf = await renderCv(input);
      const path = `branches/${code}.pdf`;
      must(await sb.storage.from("cv").upload(path, Buffer.from(pdf), { upsert: true, contentType: "application/pdf" }), `upload ${code}`);
      const fam_ = P.ROLE_FAMILIES.find((f) => f.id === String(fam))!;
      must(await sb.from("ps_cv_versions").upsert({
        code, name: `${fam_.name} (${reg === "startup" ? "startup, English" : "corporate, Swedish"})`,
        lead_line: built.lead, summary: built.lead, fact_ids: built.factIds, skill_names: built.skills,
        role_families: [String(fam)], register: reg, family: fam, base: P.CV_BRANCHES.find((b) => b.fam === fam)!.base,
        pdf_path: `cv/${path}`, generated_at: new Date().toISOString(), frozen: true,
      }), `cv ${code}`);
      console.log("cv", code, pdf.length, "bytes");
    }
  }
  {
    const t = P.CV_TS_BUILDER;
    const built = buildCv(5, "startup");
    const proof = t.proof.map((id) => P.FACTS.find((f) => f.id === id)!.text);
    const input = { ...built.input, leadLine: t.lead, summary: `Proof: ${proof.join(" ")}` };
    if (findBannedTerm(JSON.stringify(input))) throw new Error("Banned term in CV 5T");
    const pdf = await renderCv(input);
    must(await sb.storage.from("cv").upload("branches/5T.pdf", Buffer.from(pdf), { upsert: true, contentType: "application/pdf" }), "upload 5T");
    must(await sb.from("ps_cv_versions").upsert({ code: "5T", name: "T&S Builder (product roles, English)", lead_line: t.lead, summary: t.lead, fact_ids: [...t.proof, ...t.extra], skill_names: built.skills, role_families: ["5"], register: "startup", family: 5, base: "C", pdf_path: "cv/branches/5T.pdf", generated_at: new Date().toISOString(), frozen: true }), "cv 5T");
    console.log("cv 5T", pdf.length, "bytes");
  }
  // English corporate PDFs for applications that lead with English.
  for (const fam of [1, 2, 3, 4, 5, 6]) {
    const built = buildCv(fam, "corporate");
    const pdf = await renderCv(built.input);
    must(await sb.storage.from("cv").upload(`branches/${fam}C-en.pdf`, Buffer.from(pdf), { upsert: true, contentType: "application/pdf" }), "upload en corporate");
  }
  for (const f of P.ROLE_FAMILIES) await sb.from("ps_role_families").update({ cv_version: `${f.id}S` }).eq("id", f.id);
}

/** Imports the older profile tables (same database) into Persephone, tagged legacy. */
async function legacy() {
  const tables = ["user_experiences", "user_skills", "user_anecdotes", "user_awards", "user_certifications", "user_education", "user_volunteer", "tech_projects", "tech_certifications"];
  const get = async (t: string) => ((await sb.from(t).select("*")).data ?? []) as any[];
  must(await sb.from("ps_facts").delete().contains("tags", ["legacy"]), "clear legacy facts");
  must(await sb.from("ps_experiences").delete().contains("categories", ["legacy"]), "clear legacy exps");
  must(await sb.from("ps_stories").delete().contains("tags", ["legacy"]), "clear legacy stories");
  let skipped = 0;
  const ok = (s: string) => {
    if (findBannedTerm(s)) {
      skipped++;
      return false;
    }
    return true;
  };
  const facts: any[] = [];
  let n = 0;
  const seen = new Set<string>();
  for (const r of await get("user_experiences")) {
    const key = `${r.company}|${r.title}|${r.dates ?? r.start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = [r.description_long || r.description, ...(r.bullets ?? []), ...(r.key_achievements ?? [])].filter(Boolean).join(" ");
    if (!ok(`${r.company} ${r.title} ${text}`)) continue;
    const ins = must(await sb.from("ps_experiences").insert({
      org: r.company, title: r.title, dates_label: r.dates || [r.start_date, r.end_date].filter(Boolean).join(" to "),
      location: r.location ?? null, summary: r.description_short || r.description || "", bullets: r.bullets ?? [],
      kind: "job", categories: ["legacy", ...(r.categories ?? [])], sort: 100 + (r.sort_order ?? 0), cv_versions: [],
      source_file: "platsbanken-ai:user_experiences", show_on_portfolio: false,
    }).select("id").single(), "legacy exp") as { id: string };
    if (text.trim()) facts.push({ id: `L-EXP-${++n}`, text: `${r.title}, ${r.company} (${r.dates ?? ""}): ${text}`.slice(0, 2000), experience_id: ins.id, tags: ["legacy", ...(r.keywords ?? []).slice(0, 8)], src: "platsbanken-ai:user_experiences" });
  }
  const simple: [string, (r: any) => string][] = [
    ["user_anecdotes", (r) => `${r.title}: ${r.content}`],
    ["user_awards", (r) => [r.award_text, r.description].filter(Boolean).join(". ")],
    ["user_certifications", (r) => Object.values(r).filter((v) => typeof v === "string" && v.length > 2 && !/^[0-9a-f-]{36}$/.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v)).join(", ")],
    ["user_education", (r) => Object.values(r).filter((v) => typeof v === "string" && v.length > 2 && !/^[0-9a-f-]{36}$/.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v)).join(", ")],
    ["user_volunteer", (r) => Object.values(r).filter((v) => typeof v === "string" && v.length > 2 && !/^[0-9a-f-]{36}$/.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v)).join(", ")],
    ["tech_projects", (r) => `${r.project_name}: ${r.description ?? ""} ${(r.highlights ?? []).join(" ")} Stack: ${(r.tech_stack ?? []).join(", ")}`],
    ["tech_certifications", (r) => Object.values(r).filter((v) => typeof v === "string" && v.length > 2 && !/^[0-9a-f-]{36}$/.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v)).join(", ")],
  ];
  for (const [t, fmt] of simple) {
    let i = 0;
    for (const r of await get(t)) {
      const text = fmt(r);
      if (!text.trim() || !ok(text)) continue;
      facts.push({ id: `L-${t.toUpperCase()}-${++i}`, text: text.slice(0, 2000), tags: ["legacy", t], src: `platsbanken-ai:${t}` });
    }
  }
  for (let i = 0; i < facts.length; i += 100) {
    must(await sb.from("ps_facts").upsert(facts.slice(i, i + 100).map((f) => ({
      id: f.id, text: f.text, experience_id: f.experience_id ?? null, tags: f.tags, role_families: [], strength: 1,
      source_file: f.src, numbers: {}, embedding: toPgVector(embed(f.text)),
    }))), "legacy facts");
  }
  // Legacy anecdotes as stories
  const stories = (await get("user_anecdotes")).filter((a) => ok(`${a.title} ${a.content}`)).map((a) => ({
    title: a.title, situation: a.content, tags: ["legacy"], role_families: [], fact_ids: [],
  }));
  if (stories.length) must(await sb.from("ps_stories").insert(stories), "legacy stories");
  // Legacy skills: add any skill not already present.
  const { data: have } = await sb.from("ps_skills").select("name");
  const names = new Set((have ?? []).map((s: any) => s.name.toLowerCase()));
  const add: any[] = [];
  for (const s of await get("user_skills")) {
    const name = String(s.skill_text ?? "").trim().slice(0, 120);
    if (!name || names.has(name.toLowerCase()) || !ok(name) || /^(norsk|dansk|norweg|danish)/i.test(name)) continue;
    names.add(name.toLowerCase());
    add.push({ name, category: `legacy:${s.category ?? s.skill_type ?? "other"}`, level: 3, role_families: [] });
  }
  if (add.length) must(await sb.from("ps_skills").upsert(add, { onConflict: "name" }), "legacy skills");
  console.log("legacy facts", facts.length, "stories", stories.length, "skills", add.length, "skipped (guard)", skipped);
}

/** crosstrees_v1 scores for the target roles, from a skill list per role (extracted by Claude). */
async function targetScores() {
  const { data: mySkills } = await sb.from("ps_skills").select("name,aliases").not("category", "like", "legacy%");
  const mine = new Set<string>();
  for (const s of mySkills ?? []) {
    mine.add(normalizeSkill(s.name));
    for (const a of s.aliases ?? []) mine.add(normalizeSkill(a));
  }
  const { data: jobs } = await sb.from("ps_jobs").select("id,title,company_name,family_id,status").eq("source", "target").neq("status", "closed");
  for (const j of jobs ?? []) {
    const res = await ai.messages.create({
      model: "claude-haiku-4-5", max_tokens: 900, temperature: 0,
      system: "You list the skills a typical Stockholm job posting with this exact title at this company requires. Return JSON only: {\"skills\":[{\"name\":\"...\",\"importance\":\"required|preferred|bonus\",\"years\":number|null}]}. 6 to 14 skills, short canonical names (for example: Python, SQL, Google Ads, Stakeholder management).",
      messages: [{ role: "user", content: `${j.title} at ${j.company_name}` }],
    });
    const t = res.content.map((b: any) => b.text ?? "").join("");
    const parsed = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const map = new Map<string, Importance>();
    await sb.from("ps_job_skills").delete().eq("job_id", j.id);
    const rows: any[] = [];
    for (const s of parsed.skills ?? []) {
      const n = normalizeSkill(s.name);
      if (!map.has(n)) map.set(n, s.importance);
      rows.push({ job_id: j.id, skill_name: s.name, importance: s.importance, years_required: s.years ?? null, extracted_by: "claude-haiku-4-5:title-only" });
    }
    if (rows.length) await sb.from("ps_job_skills").upsert(rows, { onConflict: "job_id,skill_name" });
    const fit = calculateFitScore(mine, map);
    if (!fit) continue;
    const { data: v } = await sb.from("ps_matches").select("score").eq("job_id", j.id).eq("method", "vetlandajobb_v1").maybeSingle();
    const big = ["H&M", "SEB", "Klarna", "Spotify", "Google", "Fortnox", "Swedbank", "KPMG", "Deloitte"].includes(j.company_name) ? 10 : 0;
    const rank = 0.5 * (v?.score ?? fit.score) + 0.5 * fit.ci_low + big;
    must(await sb.from("ps_matches").upsert({
      job_id: j.id, method: "crosstrees_v1", score: fit.score, ci_low: fit.ci_low, ci_high: fit.ci_high,
      matched: fit.matched, missing_required: fit.missing_required, missing_preferred: fit.missing_preferred,
      family_id: j.family_id, rank_score: Math.round(rank * 10) / 10, tier: fit.score > 85 ? "direct" : fit.score >= 60 ? "bridge" : "stretch",
      why: `Matches ${fit.matched_required.length} of ${fit.matched_required.length + fit.missing_required.length} required skills (title-based skill list until the full ad is fetched).`,
    }, { onConflict: "job_id,method" }), "crosstrees match");
    console.log("score", j.company_name, j.title, fit.score, `[${fit.ci_low}-${fit.ci_high}]`);
  }
}

async function local() {
  for (const f of LOCAL_FACTS) if (findBannedTerm(f.text)) throw new Error(f.id);
  must(await sb.from("ps_facts").upsert(LOCAL_FACTS.map((f) => ({ id: f.id, text: f.text, tags: ["local", ...f.tags], role_families: [], strength: 3, source_file: "cv-sv-2026-11-23", numbers: {}, embedding: toPgVector(embed(f.text)) }))), "local facts");
  const pdf = await renderCv({
    name: "Linnea Moritz", leadLine: LOCAL_CV.lead, contact: "Vetlanda  |  linneamoritzcv@gmail.com", summary: "",
    experiences: LOCAL_CV.experiences, skills: LOCAL_CV.skills, education: LOCAL_CV.education, languages: LOCAL_CV.languages, extras: LOCAL_CV.extras,
    labels: { experience: "Arbetslivserfarenhet", skills: "Kompetenser", education: "Utbildning", languages: "Språk", also: "Ledarskap och engagemang" },
  });
  must(await sb.storage.from("cv").upload("branches/L.pdf", Buffer.from(pdf), { upsert: true, contentType: "application/pdf" }), "upload L");
  must(await sb.from("ps_cv_versions").upsert({ code: "L", name: "Lokalt: Vetlanda (svenska)", lead_line: LOCAL_CV.lead, summary: LOCAL_CV.lead, fact_ids: LOCAL_FACTS.map((f) => f.id), skill_names: LOCAL_CV.skills, role_families: [], register: "local", family: null, base: "L", pdf_path: "cv/branches/L.pdf", generated_at: new Date().toISOString(), frozen: true }), "cv L");
  console.log("cv L", pdf.length);
}

const steps: Record<string, () => Promise<unknown>> = { profile, families, experiencesAndFacts, skills, gifts, stories, rules, companies, graph, targets, plan, legacy, cvs, targetScores, local };
(async () => {
  for (const [name, fn] of Object.entries(steps)) {
    if (only && only !== name) continue;
    process.stdout.write(`${name}... `);
    await fn();
    console.log("ok");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
