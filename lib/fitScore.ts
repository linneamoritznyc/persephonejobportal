/**
 * Port of crosstreeslaborintelligence services/matching-api/src/services/fit_score.py:
 * weighted TF-IDF overlap (required 60 / preferred 30 / bonus 10) with a
 * Wilson 95% confidence interval. Returns null when the job has no skill
 * data, never a fake default score.
 */
export type Importance = "required" | "preferred" | "bonus";

export function wilsonScoreInterval(p: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export interface FitResult {
  score: number;
  ci_low: number;
  ci_high: number;
  matched: string[];
  matched_required: string[];
  missing_required: string[];
  missing_preferred: string[];
}

export function calculateFitScore(
  userSkills: Set<string>,
  jobSkills: Map<string, Importance>,
  idf: Map<string, number> = new Map()
): FitResult | null {
  if (jobSkills.size === 0) return null;
  const by = (imp: Importance) => new Set([...jobSkills].filter(([, v]) => v === imp).map(([k]) => k));
  const required = by("required");
  const preferred = by("preferred");
  const bonus = by("bonus");

  const overlap = (set: Set<string>) => {
    if (set.size === 0) return 1;
    let total = 0;
    let hit = 0;
    for (const s of set) {
      const w = idf.get(s) ?? 1;
      total += w;
      if (userSkills.has(s)) hit += w;
    }
    return total > 0 ? hit / total : 0;
  };

  // When a tier is empty the Python original counts it as full overlap; we
  // redistribute its weight instead so a job with only "required" skills is
  // scored on those alone.
  const tiers: [Set<string>, number][] = [
    [required, 0.6],
    [preferred, 0.3],
    [bonus, 0.1],
  ];
  const live = tiers.filter(([s]) => s.size > 0);
  const wsum = live.reduce((s, [, w]) => s + w, 0) || 1;
  const score = live.reduce((s, [set, w]) => s + overlap(set) * (w / wsum), 0) * 100;

  const matchedRequired = [...required].filter((s) => userSkills.has(s));
  const n = required.size || preferred.size;
  const base = required.size ? matchedRequired.length : [...preferred].filter((s) => userSkills.has(s)).length;
  const [lo, hi] = wilsonScoreInterval(n ? base / n : 0, n);

  return {
    score: Math.round(score * 10) / 10,
    ci_low: Math.round(lo * 1000) / 10,
    ci_high: Math.round(hi * 1000) / 10,
    matched: [...jobSkills.keys()].filter((s) => userSkills.has(s)),
    matched_required: matchedRequired,
    missing_required: [...required].filter((s) => !userSkills.has(s)),
    missing_preferred: [...preferred].filter((s) => !userSkills.has(s)),
  };
}
