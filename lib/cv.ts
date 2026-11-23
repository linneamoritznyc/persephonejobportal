/** Builds CV content for a branch (family x register) from the profile data. No server-only imports. */
import { EXPERIENCES, FACTS, PROFILE, SKILLS, CV_BRANCHES, SWEDISH_LEADS, type Exp } from "./seed/profile";
import type { CvInput } from "./pdf";

export const REGISTERS = ["startup", "corporate"] as const;
export type Register = (typeof REGISTERS)[number];

export function branchCode(fam: number, register: Register) {
  return `${fam}${register === "startup" ? "S" : "C"}`;
}

const JOB_ORDER = ["sfw", "financial_healer", "prepartum", "independent", "human_bridge", "keeping_tabs", "clubhouse", "tiktok", "youtube", "sacc", "minerva_project", "gtech", "minerva_ambassador"];

const FAMILY_SKILLS: Record<number, string[]> = {
  1: ["Claude API", "Claude Code", "MCP", "AI automation", "Voice agents", "TypeScript", "Next.js", "React", "Python", "SQL", "Supabase", "Vercel", "Railway", "GitHub Actions", "Jest", "Lovable", "Replit"],
  2: ["Google Ads", "Smart Bidding", "GA4", "Google Tag Manager", "GTM Server", "BigQuery", "SQL", "Looker", "Offline conversion import", "Shopify", "Python", "Claude Code", "Google Ads Scripts"],
  3: ["Claude API", "Voice agents", "ElevenLabs", "Retell AI", "AI automation", "Customer onboarding", "Workshops and training", "TypeScript", "Next.js", "Supabase", "Webhooks", "MCP", "Claude Code"],
  4: ["Remotion", "Video editing", "ElevenLabs", "Social media strategy", "Copywriting", "Shopify", "Claude Code", "AI content pipelines", "Lovable", "Replit", "Next.js"],
  5: ["Trust & Safety", "Content moderation", "Policy enforcement", "Quality assurance", "Python", "SQL", "BigQuery", "Claude API", "TypeScript"],
  6: ["AI automation", "Claude API", "Python", "SQL", "BigQuery", "Stakeholder management", "Project management", "Workshops and training", "Supabase", "Claude Code", "MCP"],
};

function expLines(e: Exp, maxBullets: number) {
  return { org: e.org, title: e.title, dates: e.dates_label, location: e.location, bullets: e.bullets.slice(0, maxBullets) };
}

export function buildCv(fam: number, register: Register): { input: CvInput; lead: string; factIds: string[]; skills: string[] } {
  const branch = CV_BRANCHES.find((b) => b.fam === fam)!;
  const factIds = [...branch.proof, ...branch.extra];
  const lead = register === "corporate" ? SWEDISH_LEADS[fam] : branch.lead;
  const proofText = branch.proof.map((id) => FACTS.find((f) => f.id === id)!.text);

  const jobs = JOB_ORDER.map((k) => EXPERIENCES.find((e) => e.key === k)!).filter((e) => {
    if (e.cv_versions && !e.cv_versions.includes(register)) return false;
    return true;
  });

  const experiences: CvInput["experiences"] = [];
  let groupDone = false;
  for (const e of jobs) {
    if (e.group_header) {
      if (groupDone) continue;
      groupDone = true;
      const fh = EXPERIENCES.find((x) => x.key === "financial_healer")!;
      const pp = EXPERIENCES.find((x) => x.key === "prepartum")!;
      experiences.push({
        org: "The Financial Healer and PrePartum",
        title: "Product and Technical Lead",
        dates: "Feb to Apr 2026",
        location: "Remote, US founders",
        bullets: [
          "§The Financial Healer (credit repair, Cleveland)",
          ...fh.bullets,
          "§PrePartum (Mother of Many)",
          ...pp.bullets,
        ],
      });
      continue;
    }
    if (e.key === "human_bridge") {
      experiences.push({ org: e.org, title: e.title, dates: e.dates_label, bullets: [] });
      continue;
    }
    experiences.push(expLines(e, e.key === "sfw" ? 6 : 3));
  }

  const projects = ["lead_scoring", "kompetensgrafen", "63to11", "anti_apathy", "bidragsguiden", "apex", "onemillion"].map((k) => EXPERIENCES.find((e) => e.key === k)!);
  const extras = [
    ...projects.map((p) => `${p.org}: ${p.bullets[0]}`),
    "Repo: github.com/linneamoritznyc/bigquery-lead-scoring-sem",
    "Artist: 39 exhibitions in 21 cities, 3 first prizes including Stockholms Konstsalong 2024. Keeping Tabs on a 70 x 30 m LED display at Art Basel Hong Kong.",
    "Award: First Prize, Global Startup Weekend Stockholm 2019. Founded The Right Solution Project at 15: raised 120,000 SEK, 400+ care packages.",
  ];

  const skills = FAMILY_SKILLS[fam];
  const allSkills = [...new Set([...skills, ...SKILLS.filter((s) => s.category === "Build").map((s) => s.name)])].slice(0, 26);

  return {
    lead,
    factIds,
    skills: allSkills,
    input: {
      name: PROFILE.name,
      leadLine: lead,
      contact: `Stockholm  |  ${PROFILE.email}  |  linkedin.com/in/linneamoritz  |  github.com/linneamoritznyc  |  linneamoritzdev.vercel.app`,
      summary: `Proof: ${proofText.join(" ")}`,
      experiences,
      skills: allSkills,
      education: [
        "Minerva University, B.S. Social Sciences (Economics and Business Administration), 2017 to 2021. GPA 3.6, 1.8% admission rate, studied in 5 countries, mentored 45 students through capstones.",
        "UWC Red Cross Nordic, IB Bilingual Diploma, 2015 to 2017. Full scholarship, chosen from 120 Swedish applicants, GPA 3.85.",
      ],
      languages: "English (native), Swedish (native), Mandarin (HSK 3)",
      extras,
    },
  };
}
