/**
 * Hard-rule tests. Unit tests always run; database tests run when
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BANNED_TERMS, findBannedTerm, assertNoBannedTerms, lintStyle, isBlockedCompany, isGigTitle, NON_PERMANENT } from "../lib/guard";
import * as P from "../lib/seed/profile";
import { wilsonScoreInterval, calculateFitScore } from "../lib/score/crosstrees";
import { scoreJobVetlanda } from "../lib/score/vetlanda";
import { isPermanentFullTime } from "../lib/hunt/platsbanken";
import { personalizedPageRank } from "../lib/gifts/pagerank";
import { OCCUPATIONS, EDGES, SEED_OCCUPATIONS } from "../lib/seed/graph";
import { buildMime } from "../lib/mail/mime";

const ROOT = new URL("..", import.meta.url).pathname;
const sb = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
const db = sb ? test : test.skip;

const ALLOW_BANNED = [".github/workflows/ci.yml", "lib/guard.ts", "docs/prompts/02-update.md", "docs/prompts/03-gifts-engine.md", "tests/rules.test.ts"];

function grep(pattern: string): string[] {
  try {
    return execSync(`grep -rliE "${pattern}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude=package-lock.json`, { cwd: ROOT }).toString().trim().split("\n").filter(Boolean).map((f) => f.replace(/^\.\//, ""));
  } catch {
    return [];
  }
}

test("no send capability: no send code in the repo", () => {
  const hits = grep("sendMail|messages\\.send|smtp|resend|postmark|sendgrid").filter((f) => !f.startsWith("docs/prompts/") && f !== "tests/rules.test.ts" && f !== ".github/workflows/ci.yml");
  assert.deepEqual(hits, []);
});

test("no send capability: no send-capable dependency", () => {
  const pkg = JSON.parse(readFileSync(ROOT + "package.json", "utf8"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const bad = deps.filter((d) => /nodemailer|resend|postmark|sendgrid|mailgun|smtp|@sendgrid|googleapis|@getbrevo|brevo/i.test(d));
  assert.deepEqual(bad, []);
  const mail = readFileSync(ROOT + "lib/mail/imapDraft.ts", "utf8");
  assert.ok(!/\.send\(|createTransport|sendmail/i.test(mail));
  assert.ok(/append\(/.test(mail), "drafts are created by IMAP APPEND");
});

test("banned terms: zero hits in the repo outside the list itself", () => {
  const hits = grep("lotus|careergenius|pitchgenius|vcgenius").filter((f) => !ALLOW_BANNED.includes(f));
  assert.deepEqual(hits, []);
});

test("banned terms: guard throws and the seed data is clean", () => {
  for (const t of BANNED_TERMS) assert.throws(() => assertNoBannedTerms(`I worked at ${t}.`));
  const all = JSON.stringify(P);
  assert.equal(findBannedTerm(all), null);
});

test("no em dashes and clean style in seed text", () => {
  const texts = [...P.FACTS.map((f) => f.text), ...P.STORIES.flatMap((s) => [s.title, s.situation, s.action, s.result]), ...P.PORTFOLIO_CARDS.flatMap((c) => [c.saw, c.built, c.reached, c.title])];
  for (const t of texts) assert.deepEqual(lintStyle(t), [], t);
  assert.ok(!JSON.stringify(P).includes("—"));
});

test("linter rejects the banned patterns", () => {
  for (const s of ["It is fast — really.", "It is not just a tool.", "I chose speed rather than scale.", "It isn't hard.", "I built X instead of Y."]) assert.ok(lintStyle(s).length > 0, s);
});

test("Financial Healer and PrePartum: Feb to Apr 2026, no company header", () => {
  const fh = P.EXPERIENCES.find((e) => e.key === "financial_healer")!;
  const pp = P.EXPERIENCES.find((e) => e.key === "prepartum")!;
  for (const e of [fh, pp]) {
    assert.equal(e.start_date, "2026-02-01");
    assert.equal(e.end_date, "2026-04-30");
    assert.equal(e.dates_label, "Feb to Apr 2026");
    assert.equal(e.group_header, "The Financial Healer and PrePartum, Product and Technical Lead (Feb to Apr 2026, remote, US founders)");
  }
  assert.ok(P.EXPERIENCES.filter((e) => e.end_date === null && e.kind === "job").every((e) => e.key === "sfw"), "SFW is the only current role");
});

test("languages: never Norwegian or Danish", () => {
  assert.deepEqual(P.PROFILE.languages.map((l) => l.name).sort(), ["English", "Mandarin", "Swedish"]);
  assert.ok(lintStyle("I speak fluent Norwegian.").includes("claims Norwegian/Danish"));
});

test("blocked companies and gig titles are filtered", () => {
  for (const c of ["Precis", "Precis Digital", "Outlier AI", "Lionbridge", "Remotasks", "DataAnnotation", "Appen", "TELUS AI", "Scale AI"]) assert.ok(isBlockedCompany(c), c);
  assert.ok(!isBlockedCompany("Spotify"));
  for (const t of ["AI Trainer (Swedish)", "Search quality rater", "Data labeling specialist", "Annotator"]) assert.ok(isGigTitle(t), t);
  assert.ok(!isGigTitle("Solutions Engineer"));
});

test("permanent full-time only", () => {
  assert.ok(isPermanentFullTime({ employment_type: { label: "Vanlig anställning" }, duration: { label: "Tills vidare" }, working_hours_type: { label: "Heltid" } }).ok);
  assert.ok(!isPermanentFullTime({ employment_type: { label: "Behovsanställning" }, working_hours_type: { label: "Heltid" } }).ok);
  assert.ok(!isPermanentFullTime({ employment_type: { label: "Vanlig anställning" }, duration: { label: "3 - 6 månader" }, working_hours_type: { label: "Deltid" } }).ok);
  for (const t of ["Freelance AI developer", "Konsultuppdrag: utvecklare", "Interim CTO", "Bemanning: lagerarbetare", "Contract Solutions Engineer"]) assert.ok(NON_PERMANENT.test(t), t);
});

test("fit scores: Wilson interval and regression values", () => {
  const [lo, hi] = wilsonScoreInterval(1, 5);
  assert.ok(lo > 0.5 && hi === 1);
  assert.deepEqual(wilsonScoreInterval(0, 0), [0, 1]);
  assert.equal(calculateFitScore(new Set(["python"]), new Map()), null, "no fake default score");
  const full = calculateFitScore(new Set(["a", "b"]), new Map([["a", "required"], ["b", "preferred"]]))!;
  assert.equal(full.score, 100);
  const mine = new Set(["python", "sql", "claude api", "voice agents", "customer onboarding", "rest apis"]);
  assert.equal(scoreJobVetlanda(mine, ["Python", "SQL", "Claude API", "Voice agents", "Customer onboarding", "REST APIs"], "").score, 100);
  assert.equal(scoreJobVetlanda(mine, ["Python", "SQL", "Claude API", "Voice agents", "Customer onboarding", "REST APIs", "Go", "Rust"], "").score, 75);
});

test("PageRank converges and surfaces at least 3 expected discoveries", () => {
  const nodes = OCCUPATIONS.map((o) => o.id);
  const { rank, delta } = personalizedPageRank(nodes, EDGES.filter(([a, b]) => nodes.includes(a) && nodes.includes(b)).map(([a, b, s]) => ({ source_id: a, target_id: b, score: s })), SEED_OCCUPATIONS);
  assert.ok(delta < 1e-3, `delta ${delta}`);
  const expected = ["solutions_engineer", "deployment_strategist", "forward_deployed_engineer", "marketing_technologist", "ad_tech_specialist", "creative_technologist", "customer_success_engineer", "policy_analyst", "learning_experience_designer", "program_manager_impact"];
  const top = [...rank.entries()].filter(([id]) => !SEED_OCCUPATIONS.includes(id)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);
  assert.ok(expected.filter((e) => top.includes(e)).length >= 3, top.join(","));
});

test("MIME builder makes a draft with attachments and no send headers", () => {
  const m = buildMime({ from: "Linnea Moritz <linneamoritzcv@gmail.com>", subject: "Solutions Engineer - Linnea Moritz", text: "Hello", attachments: [{ filename: "cv.pdf", content: Buffer.from("%PDF") }] }).toString();
  assert.match(m, /multipart\/mixed/);
  assert.match(m, /filename="cv.pdf"/);
  assert.ok(!/Bcc:|X-Send/i.test(m));
});

db("DB: banned terms appear in no profile or draft rows", async () => {
  for (const [table, cols] of [["ps_experiences", "org,title,summary,bullets,saw,built,reached,card_title"], ["ps_facts", "text"], ["ps_stories", "title,situation,action,result,spoken_60s,notes"], ["ps_cv_versions", "name,lead_line,summary"], ["ps_drafts", "subject,body"]] as const) {
    const { data, error } = await sb!.from(table).select(cols);
    assert.equal(error, null);
    assert.equal(findBannedTerm(JSON.stringify(data)), null, table);
  }
});

db("DB: no em dashes in generated text", async () => {
  const { data } = await sb!.from("ps_drafts").select("kind,body,subject");
  for (const d of data ?? []) assert.ok(!(d.body + (d.subject ?? "")).includes("—"), d.kind);
});

db("DB: blocked companies never appear in any view", async () => {
  const { data: blocked } = await sb!.from("ps_companies").select("id,name").eq("blocked", true);
  assert.ok((blocked ?? []).some((c: any) => c.name === "Precis"));
  const ids = (blocked ?? []).map((c: any) => c.id);
  const { data: v } = await sb!.from("ps_v_jobs").select("id,company_id,company_name");
  assert.ok(!(v ?? []).some((j: any) => ids.includes(j.company_id) || isBlockedCompany(j.company_name)));
  const { data: next } = await sb!.rpc("ps_next_jobs", { p_regions: null, p_limit: 50 });
  assert.ok(!(next ?? []).some((j: any) => isBlockedCompany(j.company_name)));
  const { data: today } = await sb!.from("ps_v_today").select("company_name");
  assert.ok(!(today ?? []).some((j: any) => isBlockedCompany(j.company_name)));
});

db("DB: every surfaced Stockholm-track job is permanent full-time", async () => {
  const { data } = await sb!.from("ps_v_jobs").select("title,employment_type").eq("is_open", true).eq("track", "stockholm");
  for (const j of data ?? []) {
    assert.ok(/permanent/i.test(j.employment_type ?? ""), `${j.title}: ${j.employment_type}`);
    assert.ok(!isGigTitle(j.title), j.title);
  }
});

db("DB: ps_next_jobs returns at most 50 and excludes applied jobs", async () => {
  const { data, error } = await sb!.rpc("ps_next_jobs", { p_regions: ["Stockholm"], p_limit: 500 });
  assert.equal(error, null);
  assert.ok((data ?? []).length <= 50);
  const { data: apps } = await sb!.from("ps_applications").select("job_id").in("status", ["sent", "drafted", "interview"]);
  const applied = new Set((apps ?? []).map((a: any) => a.job_id));
  assert.ok(!(data ?? []).some((j: any) => applied.has(j.id)));
});

db("DB: known vetlandajobb regression values are stored", async () => {
  const want: [string, string, number][] = [["ElevenLabs", "Forward Deployed Engineer, Sweden", 100], ["Aarke", "Content Lead / Ad Creator", 100], ["Fortnox", "Product Manager, AI Assistant", 100], ["Sana", "Engagement Associate", 100], ["Klarna", "Ad Tech Specialist", 100], ["Google", "Advertising Solutions Architect, Measurement", 100], ["Lovable", "Product Experience Specialist", 88]];
  for (const [c, t, s] of want) {
    const { data: j } = await sb!.from("ps_jobs").select("id").eq("company_name", c).eq("title", t).eq("source", "target").single();
    const { data: m } = await sb!.from("ps_matches").select("score").eq("job_id", j!.id).eq("method", "vetlandajobb_v1").single();
    assert.equal(Number(m!.score), s, `${c} ${t}`);
    const { data: ct } = await sb!.from("ps_matches").select("score,ci_low,ci_high").eq("job_id", j!.id).eq("method", "crosstrees_v1").maybeSingle();
    assert.ok(ct && ct.ci_low != null && ct.ci_high != null, `crosstrees score stored for ${c}`);
  }
});

db("DB: Financial Healer and PrePartum rows carry the right dates", async () => {
  const { data } = await sb!.from("ps_experiences").select("org,dates_label,group_header").in("org", ["The Financial Healer", "PrePartum (Mother of Many)"]);
  assert.equal(data?.length, 2);
  for (const r of data ?? []) assert.equal(r.dates_label, "Feb to Apr 2026");
});

db("DB: the only allowed login address is linneamoritzcv@gmail.com", async () => {
  const { data } = await sb!.from("ps_profile").select("email").eq("id", 1).single();
  assert.equal(data?.email, "linneamoritzcv@gmail.com");
});
