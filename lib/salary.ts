/**
 * Salary indicator. Adapted from vetlandajobb lib/salary.ts (curated keyword
 * table, first hit wins) but re-banded for Stockholm tech, product and
 * marketing roles. Always shown as an estimate, never as a promise.
 */
export interface SalaryBand {
  group: string;
  low: number;
  high: number;
}

const TABLE: [string[], SalaryBand][] = [
  [["head of", "director", "chef för", "lead product"], { group: "Leadership", low: 65000, high: 85000 }],
  [["staff", "principal", "senior"], { group: "Senior IC", low: 58000, high: 75000 }],
  [["solutions engineer", "solution engineer", "sales engineer", "forward deployed", "customer engineer"], { group: "Solutions engineering", low: 52000, high: 70000 }],
  [["ai engineer", "ml engineer", "machine learning", "llm", "ai developer", "ai-utvecklare", "automation"], { group: "AI engineering", low: 50000, high: 68000 }],
  [["full stack", "fullstack", "full-stack", "frontend", "front-end", "backend", "developer", "utvecklare", "engineer", "ingenjör"], { group: "Software engineering", low: 45000, high: 62000 }],
  [["product manager", "produktägare", "product owner", "produktchef"], { group: "Product", low: 50000, high: 68000 }],
  [["marketing technolog", "martech", "growth", "performance", "sem", "paid", "analytics", "data analyst", "analytiker"], { group: "Martech and growth", low: 42000, high: 58000 }],
  [["trust", "safety", "content policy", "moderation", "integrity"], { group: "Trust and safety", low: 38000, high: 52000 }],
  [["content", "creative", "brand", "copy", "kommunikat", "designer"], { group: "Creative and content", low: 36000, high: 50000 }],
  [["consultant", "konsult", "advisor", "rådgivare"], { group: "Consulting", low: 45000, high: 62000 }],
];

const FALLBACK: SalaryBand = { group: "Stockholm white-collar median", low: 38000, high: 52000 };

export function salaryFor(title: string, description = ""): SalaryBand {
  const hay = `${title}`.toLowerCase();
  for (const [keys, band] of TABLE) if (keys.some((k) => hay.includes(k))) return band;
  const body = description.toLowerCase().slice(0, 1500);
  for (const [keys, band] of TABLE) if (keys.some((k) => body.includes(k))) return band;
  return FALLBACK;
}

export function formatK(n: number): string {
  return `${Math.round(n / 1000)}k`;
}
