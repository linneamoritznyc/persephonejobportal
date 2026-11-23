/**
 * Content guards. Every generator runs these before saving anything.
 * This module has no imports so tests can load it directly with Node.
 */

// banned-terms-list:start
export const BANNED_TERMS = [
  "Black Lotus",
  "Black Lotus Ventures",
  "BlackLotus",
  "blacklotus",
  "CareerGenius",
  "PitchGenius",
  "VCGenius",
  "venture studio",
  "Silicon Valley studio",
];
// banned-terms-list:end

export const BLOCKED_COMPANIES = [
  "Precis",
  "Precis Digital",
  "Outlier",
  "Lionbridge",
  "Remotasks",
  "DataAnnotation",
  "Appen",
  "TELUS AI",
  "TELUS International",
  "Scale AI",
];

export const GIG_TITLE = /\b(rater|annotator|annotation|ai trainer|data label(l)?ing|prompt writer|freelance ai)\b/i;
export const NON_PERMANENT = /\b(contract(or)?|freelance|frilans|interim|konsultuppdrag|bemanning|staffing|temporary|vikariat|visstid|tidsbegr[äa]nsad|part[- ]time|deltid|internship|praktik|summer job|sommarjobb)\b/i;

export class BannedTermError extends Error {
  constructor(public term: string) {
    super(`Banned term found: ${term}`);
    this.name = "BannedTermError";
  }
}

function norm(s: string) {
  return s.toLowerCase().replace(/[\s_-]+/g, "");
}

export function findBannedTerm(text: string, extra: string[] = []): string | null {
  const hay = norm(text || "");
  for (const t of [...BANNED_TERMS, ...extra]) if (t && hay.includes(norm(t))) return t;
  return null;
}

/** Throws BannedTermError if any banned term appears. Never rewrites. */
export function assertNoBannedTerms(text: string, extra: string[] = []): void {
  const hit = findBannedTerm(text, extra);
  if (hit) throw new BannedTermError(hit);
}

export function isBlockedCompany(name: string, extraBlocked: string[] = []): boolean {
  const n = norm(name || "");
  if (!n) return false;
  return [...BLOCKED_COMPANIES, ...extraBlocked].some((b) => {
    const bn = norm(b);
    return n === bn || n.startsWith(bn) || n.includes(bn);
  });
}

export function isGigTitle(title: string): boolean {
  return GIG_TITLE.test(title || "");
}

/** Style linter: returns the list of violations (empty means clean). */
export function lintStyle(text: string): string[] {
  const v: string[] = [];
  if (/[—]/.test(text)) v.push("em dash");
  if (/\bnot just\b/i.test(text)) v.push("not just");
  if (/\brather than\b/i.test(text)) v.push("rather than");
  if (/\bisn['’]t\b/i.test(text)) v.push("isn't");
  if (/\binstead of\b/i.test(text)) v.push("instead of");
  if (/\bnot\b[^.]{1,40},\s*but\b/i.test(text)) v.push("not X, but Y");
  if (/passionate about/i.test(text)) v.push("filler: passionate about");
  if (/\b(norwegian|danish|norska|danska|norsk|dansk)\b/i.test(text) && /\b(speak|speaks|fluent|language|languages|språk|talar|kunskaper i|professionell)\b/i.test(text)) v.push("claims Norwegian/Danish");
  return v;
}

/** Mechanical cleanup that cannot change meaning (dashes, markdown). */
export function tidy(text: string): string {
  return (text || "")
    .replace(/\s*—\s*/g, ". ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\.\s*\./g, ".")
    .replace(/\. ([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
    .trim();
}
