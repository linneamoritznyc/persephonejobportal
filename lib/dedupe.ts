/**
 * Dedupe across sources, from vetlandajobb lib/dedupe.ts: two ads are the
 * same job when they share a URL or a normalised (title + employer) key.
 */
export function dedupeKey(title: string, employer: string): string {
  return `${title} ${employer}`
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\wåäö]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RawJob {
  source: string;
  external_id: string;
  title: string;
  company_name: string;
  url: string;
  location: string;
  remote: boolean;
  language?: string;
  description: string;
  occupation?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  deadline?: string | null;
  raw?: unknown;
  employment_type?: string;
  municipality?: string;
  published_at?: string | null;
}

const PRIORITY: Record<string, number> = { company: 0, jobtech: 1, remote: 2 };

export function dedupe(jobs: RawJob[]): RawJob[] {
  const prio = (j: RawJob) => PRIORITY[j.source.split(":")[0]] ?? 9;
  const ordered = [...jobs].sort((a, b) => prio(a) - prio(b));
  const out: RawJob[] = [];
  const byKey = new Map<string, number>();
  const byUrl = new Map<string, number>();
  for (const job of ordered) {
    const key = dedupeKey(job.title, job.company_name);
    const url = (job.url || "").replace(/\/$/, "");
    let idx = byKey.get(key) ?? (url ? byUrl.get(url) : undefined);
    if (idx === undefined) {
      out.push(job);
      idx = out.length - 1;
    } else {
      const merged = { ...out[idx] } as Record<string, unknown>;
      for (const [k, v] of Object.entries(job)) if (!merged[k] && v) merged[k] = v;
      out[idx] = merged as unknown as RawJob;
    }
    byKey.set(key, idx);
    if (url) byUrl.set(url, idx);
  }
  return out;
}
