/**
 * CV builder with two country formats (no server-only imports):
 *  - "se": Swedish format for companies in Sweden. Profil paragraph, reverse-chronological
 *    experience, education without GPA, languages, grouped skills, Övrigt. 2 pages is fine.
 *    Written in English (code nS) or Swedish (code nC) to match the ad.
 *  - "us": American résumé (code nU). Summary, action-verb bullets with numbers,
 *    GPA and admission rate, no personal details, aims for 1 page.
 */
import { EXPERIENCES, PROFILE, CV_BRANCHES, type Exp } from "./seed/profile";
import type { CvInput } from "./pdf";

export type Variant = "se-en" | "se-sv" | "us";
export const VARIANTS: Variant[] = ["se-en", "se-sv", "us"];

export function branchCode(fam: number, v: Variant) {
  return `${fam}${v === "se-en" ? "S" : v === "se-sv" ? "C" : "U"}`;
}

export const TAGLINE_EN = "Fine artist and technologist: eight years in tech, from content and data to AI tools";
export const TAGLINE_SV = "Konstnär och teknolog: åtta år i techbranschen, från innehåll och data till AI-verktyg";

const FAMILY_SENTENCE: Record<number, string> = {
  1: "Recently I built an AI voice agent that took over 16 manual calls a day for a US client, and internal AI tools for the Soil Food Web Foundation.",
  2: "I know Google Ads from the inside, from my time in Google Ads gTech, and today I build the web, content and automation side of marketing.",
  3: "I like being the person who explains technical work and helps people start using it, from 2,000+ applicants at Minerva to the teams I build tools for.",
  4: "I make short-form video, Reels and websites, and I build the tools behind them, such as a Reel editor with AI voiceover.",
  5: "I was the sole Trust & Safety reviewer for the Scandinavian market at Clubhouse and I build software today, so I understand both policy and product.",
  6: "In my own projects I turn public data into decisions people can act on, such as a labor-market graph and a municipal budget tool.",
};

export function profileParagraph(fam: number): string {
  return [
    "I am a fine artist with eight years in tech.",
    "I started in ad review at Google Ads and in Trust & Safety, and today I build AI tools, automations and content systems.",
    FAMILY_SENTENCE[fam],
    "I am moving to Stockholm and want a full-time role on a team where creativity and data meet.",
  ].join(" ");
}

export function usSummary(fam: number): string {
  return `Fine artist and AI builder with eight years in tech, from Google Ads gTech and Trust & Safety to AI products. Shipped 11 production web apps in 2 months.`;
}

const SKILL_GROUPS: Record<string, string[]> = {
  AI: ["Claude API", "Claude Code", "MCP", "Voice agents (Retell AI, ElevenLabs)", "AI automation"],
  Data: ["SQL", "Python", "BigQuery", "Supabase and Postgres", "Google Ads", "GA4", "Google Tag Manager"],
  "Web and content": ["TypeScript", "React", "Next.js", "Vercel", "Shopify", "Remotion", "Video editing", "Trust & Safety policy"],
  Languages: ["English (native)", "Swedish (native)", "Mandarin (HSK 3)"],
};
const GROUP_ORDER: Record<number, string[]> = {
  1: ["AI", "Web and content", "Data", "Languages"],
  2: ["Data", "Web and content", "AI", "Languages"],
  3: ["AI", "Web and content", "Data", "Languages"],
  4: ["Web and content", "AI", "Data", "Languages"],
  5: ["Web and content", "Data", "AI", "Languages"],
  6: ["AI", "Data", "Web and content", "Languages"],
};

function yearsLabel(e: Exp, sv: boolean): string {
  const a = e.start_date?.slice(0, 4);
  const b = e.end_date ? e.end_date.slice(0, 4) : sv ? "nu" : "present";
  if (!a) return e.dates_label;
  return a === b ? a : `${a}-${b}`;
}

const WORK_KEYS = ["sfw", "human_bridge", "financial_healer", "prepartum", "independent", "minerva_ambassador", "art_business", "keeping_tabs", "tiktok", "youtube", "sacc", "clubhouse", "minerva_project", "gtech"];

function byStartDesc(a: Exp, b: Exp) {
  return String(b.start_date ?? "").localeCompare(String(a.start_date ?? ""));
}

export function buildCv(fam: number, v: Variant): { input: CvInput; lead: string; factIds: string[]; skills: string[] } {
  const us = v === "us";
  const branch = CV_BRANCHES.find((b) => b.fam === fam)!;
  const exps = WORK_KEYS.map((k) => EXPERIENCES.find((e) => e.key === k)!).filter(Boolean).filter((e) => !(us && e.key === "human_bridge"));
  exps.sort(byStartDesc);

  const experiences: CvInput["experiences"] = [];
  let groupDone = false;
  for (const e of exps) {
    if (e.group_header) {
      if (groupDone) continue;
      groupDone = true;
      const fh = EXPERIENCES.find((x) => x.key === "financial_healer")!;
      const pp = EXPERIENCES.find((x) => x.key === "prepartum")!;
      experiences.push({
        org: "The Financial Healer and PrePartum",
        title: "Product and Technical Lead",
        dates: us ? "Feb 2026 - Apr 2026" : "2026",
        location: "Remote, US founders",
        bullets: ["§The Financial Healer (credit repair, Cleveland)", ...fh.bullets.slice(0, us ? 3 : 4), "§PrePartum (Mother of Many)", ...pp.bullets],
      });
      continue;
    }
    const max = us ? (experiences.length < 4 ? 3 : 1) : e.key === "sfw" ? 6 : 3;
    experiences.push({ org: e.org, title: e.title, dates: us ? e.dates_label.replace(/ to /g, " - ").replace("present", "Present") : yearsLabel(e, v === "se-sv"), location: e.location, bullets: e.bullets.slice(0, max) });
  }

  const P = (k: string) => EXPERIENCES.find((e) => e.key === k)!;
  const projects = [
    `Kompetensgrafen, labor-market graph (own project): ${P("kompetensgrafen").bullets[0].replace(/^A graph dashboard/, "a graph dashboard")}`,
    `Municipal budget decision tool (own project, "From 63 to 11 million SEK"): ${P("63to11").bullets[0].replace(/^A synthetic/, "a synthetic")}`,
    `Bidragsguiden (own project): an 8-step grant quiz with structured Claude results, Supabase row level security and rate limiting.`,
    `CBAM-Validator (own project): an EU carbon border tax exposure checker, launched February 2026.`,
    `Anti-Apathy Job Portal (own project): ${P("anti_apathy").bullets[0]}`,
    `#ONEMILLIONTALENTS (small website project, Apr to May 2026): a German campaign site with an Airtable finalist import and GDPR double opt-in with Brevo.`,
    `Apex Institute (broadcast project): ${P("apex").bullets[0]}`,
  ].slice(0, us ? 4 : 7);

  const groups = GROUP_ORDER[fam].map((g) => `${g}: ${SKILL_GROUPS[g].join(", ")}`);
  const education = us
    ? [
        "Minerva University, B.S. Social Sciences (Economics and Business Administration), 2017 to 2021. GPA 3.6. 1.8% admission rate. Studied in 5 countries. Mentored 45 students through capstones.",
        "UWC Red Cross Nordic, IB Bilingual Diploma, 2015 to 2017. GPA 3.85. Full scholarship, chosen from 120 Swedish applicants.",
      ]
    : [
        "Minerva University, B.S. Social Sciences (Economics and Business Administration), 2017 to 2021. Studied in San Francisco, Seoul, Hyderabad, Berlin and Buenos Aires. Capstone TA for 45 students.",
        "UWC Red Cross Nordic, Flekke, Norway. IB Bilingual Diploma (English and Swedish), 2015 to 2017. Full scholarship.",
      ];
  const extras = us
    ? ["Artist: 39 exhibitions in 21 cities. First prize, Global Startup Weekend Stockholm 2019."]
    : [
        "Artist: 39 exhibitions in 21 cities and 3 first prizes, including Stockholms Konstsalong 2024. The Keeping Tabs collection was shown on a 70 x 30 m LED display at Art Basel Hong Kong.",
        "First prize, Global Startup Weekend Stockholm 2019 (Terra Finance).",
        "Founded The Right Solution Project at 15: delivered 400+ care packages to schools in Ethiopia.",
      ];

  const lead = v === "se-sv" ? TAGLINE_SV : TAGLINE_EN;
  const contact = us
    ? `Stockholm, Sweden (open to US remote)  |  ${PROFILE.phone_intl}  |  ${PROFILE.email}  |  linkedin.com/in/linneamoritz  |  github.com/linneamoritznyc`
    : `Stockholm  |  ${PROFILE.phone}  |  ${PROFILE.email}  |  linkedin.com/in/linneamoritz  |  github.com/linneamoritznyc`;

  return {
    lead,
    factIds: [...branch.proof, ...branch.extra],
    skills: GROUP_ORDER[fam].flatMap((g) => SKILL_GROUPS[g]),
    input: {
      name: PROFILE.name,
      leadLine: lead,
      contact,
      summary: us ? usSummary(fam) : profileParagraph(fam),
      summaryLabel: us ? "Summary" : "Profile",
      experiences,
      skills: [],
      skillGroups: groups,
      education,
      languages: "English (native), Swedish (native), Mandarin (HSK 3)",
      projects,
      extras,
      labels: us
        ? { experience: "Experience", skills: "Skills", education: "Education", languages: "Languages", also: "Additional", projects: "Projects" }
        : { experience: "Work experience", skills: "Skills", education: "Education", languages: "Languages", also: "Other", projects: "Own projects" },
      order: us ? ["skills", "experience", "projects", "education", "also"] : ["skills", "experience", "projects", "education", "also"],
    },
  };
}
