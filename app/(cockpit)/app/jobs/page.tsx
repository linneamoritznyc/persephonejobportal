import { db } from "@/lib/supabase/admin";
import JobsTable from "./JobsTable";

export const metadata = { title: "Jobs" };

export default async function Jobs({ searchParams }: { searchParams: Promise<{ gift?: string }> }) {
  const { gift } = await searchParams;
  const sb = db();
  const [{ data: jobs }, { data: matches }, { data: apps }, { data: fb }, { data: gifts }] = await Promise.all([
    sb.from("ps_v_jobs").select("id,title,company_name,location,municipality,deadline,employment_type,url,source,status,wave,family_id,first_seen_at,found_by_term,found_by_gift,saved_for_later,is_open,salary_min,salary_max").eq("is_open", true).order("first_seen_at", { ascending: false }).limit(600),
    sb.from("ps_matches").select("job_id,method,score,ci_low,ci_high,rank_score,primary_gift,salary_estimate_min,salary_estimate_max"),
    sb.from("ps_applications").select("job_id,status"),
    sb.from("ps_feedback").select("job_id,kind").in("kind", ["skipped", "applied", "rejected"]),
    sb.from("ps_gifts").select("id,professional_language"),
  ]);
  const hidden = new Set((fb ?? []).map((f: any) => f.job_id));
  const rows = (jobs ?? [])
    .filter((j: any) => !hidden.has(j.id) && j.status !== "closed")
    .map((j: any) => {
      const c = matches?.find((m: any) => m.job_id === j.id && m.method === "crosstrees_v1");
      const v = matches?.find((m: any) => m.job_id === j.id && m.method === "vetlandajobb_v1");
      return {
        ...j,
        score: c?.score != null ? Number(c.score) : null,
        ci_low: c?.ci_low ?? null,
        ci_high: c?.ci_high ?? null,
        vetlanda: v?.score != null ? Number(v.score) : null,
        rank: c?.rank_score != null ? Number(c.rank_score) : v?.rank_score != null ? Number(v.rank_score) : null,
        primary_gift: c?.primary_gift ?? null,
        salary_min: j.salary_min ?? c?.salary_estimate_min ?? null,
        salary_max: j.salary_max ?? c?.salary_estimate_max ?? null,
        app_status: apps?.find((a: any) => a.job_id === j.id)?.status ?? null,
      };
    });
  const giftNames = Object.fromEntries((gifts ?? []).map((g: any) => [g.id, g.professional_language?.[0] ?? g.id]));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl">Jobs</h1>
        <p className="text-muted text-sm mt-1">Permanent, full-time roles in Stockholm, from Platsbanken, career pages and Kompetensgrafen discovery.</p>
      </header>
      <JobsTable rows={rows} giftNames={giftNames} initialGift={gift ?? ""} />
    </div>
  );
}
