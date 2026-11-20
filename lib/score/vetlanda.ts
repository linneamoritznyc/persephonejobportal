/**
 * Port of vetlandajobb lib/match.ts scoreJob: the share of the job's listed
 * skills (required + nice to have) the user has. Above 85 is a direct match,
 * 60 to 85 a bridge. Without structured skills it falls back to word hits.
 */
import { normalizeSkill } from "../match";

export function scoreJobVetlanda(mySkills: Set<string>, jobSkills: string[], text: string): { score: number; matched: string[]; missing: string[] } {
  const req = [...new Set(jobSkills.map(normalizeSkill))];
  if (req.length === 0) {
    const t = normalizeSkill(text);
    const hits = [...mySkills].filter((s) => s.length > 2 && t.includes(s));
    return { score: hits.length ? Math.min(50 + hits.length * 10, 80) : 0, matched: hits, missing: [] };
  }
  const matched = req.filter((s) => mySkills.has(s));
  return { score: Math.round((matched.length / req.length) * 100), matched, missing: req.filter((s) => !mySkills.has(s)) };
}
