/** Loads everything the agent needs once per run. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SkillIndex } from "../score/skillmatch";

export interface Ctx {
  sb: SupabaseClient;
  profile: any;
  skills: { name: string; aliases: string[]; category: string }[];
  index: SkillIndex;
  localIndex: SkillIndex;
  localSkills: { name: string; aliases: string[]; category: string }[];
  masterLocal: string;
  facts: { id: string; text: string; tags: string[]; role_families: string[]; strength: number }[];
  gifts: any[];
  families: any[];
  companies: any[];
  rules: { kind: string; name: string | null; rule: string }[];
  cvs: any[];
  master: string; // cached prompt block
}

export async function loadCtx(sb: SupabaseClient): Promise<Ctx> {
  const [profile, skills, facts, gifts, families, companies, rules, cvs, localFacts] = await Promise.all([
    sb.from("ps_profile").select("*").eq("id", 1).single(),
    sb.from("ps_skills").select("name,aliases,category,learning_target,gap_note"),
    sb.from("ps_facts").select("id,text,tags,role_families,strength").not("tags", "cs", "{legacy}").not("id", "like", "P-%"),
    sb.from("ps_gifts").select("*").order("sort"),
    sb.from("ps_role_families").select("*"),
    sb.from("ps_companies").select("*"),
    sb.from("ps_writing_rules").select("kind,name,rule").eq("active", true).order("sort"),
    sb.from("ps_cv_versions").select("*"),
    sb.from("ps_facts").select("id,text").or("tags.cs.{local},tags.cs.{legacy}").limit(400),
  ]);
  const core = (skills.data ?? []).filter((s: any) => !String(s.category).startsWith("legacy") && !s.learning_target);
  const master = [
    "MASTER PROFILE (the only facts you may use; cite fact ids in square brackets when you use them)",
    `Name: ${profile.data?.name}. Location: Stockholm. Languages: English and Swedish, both native; Mandarin HSK 3.`,
    `Current role: Soil Food Web Foundation, Contractor, Digital, Content and Grants, Sep 2026 to present.`,
    `Thread (outgoing version): ${profile.data?.thread_professional}`,
    "",
    "FACTS:",
    ...(facts.data ?? []).map((f: any) => `[${f.id}] ${f.text}`),
    "",
    "STRENGTHS (internal names, professional language in brackets; never write the internal names in outgoing text):",
    ...(gifts.data ?? []).map((g: any) => `${g.id}: ${g.essence} (${(g.professional_language ?? []).join(", ")})`),
    "",
    "WRITING RULES:",
    ...(rules.data ?? []).filter((r: any) => r.kind === "style" || r.kind === "fact_rule").map((r: any) => `- ${r.rule}`),
  ].join("\n");
  const localSkills = (skills.data ?? []).filter((s: any) => !s.learning_target) as any;
  const masterLocal = [
    "PROFIL FÖR LOKALA JOBB I VETLANDA (använd bara dessa fakta; ange fakta-id inom hakparentes när du använder dem)",
    "Namn: Linnea Moritz. Bor i Vetlanda. Svenska och engelska på modersmålsnivå. Kan börja direkt.",
    ...(localFacts.data ?? []).map((f: any) => `[${f.id}] ${f.text}`.slice(0, 600)),
  ].join("\n");
  return {
    sb,
    localIndex: new SkillIndex(localSkills),
    localSkills,
    masterLocal,
    profile: profile.data,
    skills: core as any,
    index: new SkillIndex(core as any),
    facts: (facts.data ?? []) as any,
    gifts: gifts.data ?? [],
    families: families.data ?? [],
    companies: companies.data ?? [],
    rules: (rules.data ?? []) as any,
    cvs: cvs.data ?? [],
    master,
  };
}
