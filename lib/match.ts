/**
 * Thresholds from vetlandajobb lib/match.ts: a direct match is above 85,
 * a bridge (near-match worth a short upskill) is 60 to 85.
 */
export const BRIDGE_MIN = 60;
export const BRIDGE_MAX = 85;
export const DRAFT_THRESHOLD = 85;

export function tierFor(score: number): "direct" | "bridge" | "stretch" {
  if (score > BRIDGE_MAX) return "direct";
  if (score >= BRIDGE_MIN) return "bridge";
  return "stretch";
}

export function normalizeSkill(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\.js\b/g, "js")
    .replace(/[^a-z0-9+#åäö ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rank score = fit score plus salary, big-company and deadline weighting.
 * Each bonus is small so the fit score stays the main signal.
 */
export function rankScore(opts: {
  score: number;
  familyPriority?: number; // 1 (highest) .. 5
  bigCompanyBonus?: number;
  isBigCompany?: boolean;
  salaryMax?: number | null;
  targetMin: number;
  deadline?: string | null;
  remote?: boolean;
}): number {
  let r = opts.score;
  if (opts.isBigCompany) r += opts.bigCompanyBonus ?? 5;
  if (opts.familyPriority) r += (6 - opts.familyPriority) * 1.5;
  if (opts.salaryMax) r += opts.salaryMax >= opts.targetMin ? 4 : -4;
  if (opts.deadline) {
    const days = (new Date(opts.deadline).getTime() - Date.now()) / 86_400_000;
    if (days < 0) r -= 50;
    else if (days <= 7) r += 3;
  }
  if (opts.remote) r += 1;
  return Math.round(r * 10) / 10;
}
