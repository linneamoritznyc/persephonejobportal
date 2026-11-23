import { db } from "@/lib/supabase/admin";
import Board from "./Board";
import { FAMILY } from "@/lib/cockpit/format";
import { getMode } from "@/lib/mode";

export const metadata = { title: "Applications" };

export default async function Applications() {
  const sb = db();
  const mode = await getMode();
  const [{ data: apps }, { data: matches }, { data: gifts }] = await Promise.all([
    sb.from("ps_applications").select("*,ps_jobs!inner(id,title,company_name,source,family_id,found_by_term,company_id,blocked_reason,mode)").eq("ps_jobs.mode", mode).is("ps_jobs.blocked_reason", null).order("stage_changed_at", { ascending: false }),
    sb.from("ps_matches").select("job_id,primary_gift,salary_estimate_max").eq("method", "crosstrees_v1"),
    sb.from("ps_gifts").select("id,professional_language"),
  ]);
  const pro = Object.fromEntries((gifts ?? []).map((g: any) => [g.id, g.professional_language?.[0] ?? g.id]));
  const rows = (apps ?? []).map((a: any) => ({ ...a, primary_gift: matches?.find((m: any) => m.job_id === a.job_id)?.primary_gift ?? null, salary: matches?.find((m: any) => m.job_id === a.job_id)?.salary_estimate_max ?? null }));

  const sent = rows.filter((a) => a.applied_at);
  const replied = (a: any) => ["interview", "offer", "rejected"].includes(a.status) || a.replied_at;
  const rate = (key: (a: any) => string | null) => {
    const m = new Map<string, { n: number; r: number }>();
    for (const a of sent) {
      const k = key(a) ?? "unknown";
      const e = m.get(k) ?? { n: 0, r: 0 };
      e.n++;
      if (replied(a)) e.r++;
      m.set(k, e);
    }
    return [...m.entries()].sort((x, y) => y[1].r / y[1].n - x[1].r / x[1].n);
  };
  const byGift = rate((a) => (a.primary_gift ? pro[a.primary_gift] : null));
  const byFam = rate((a) => (a.ps_jobs.family_id ? FAMILY[a.ps_jobs.family_id] : null));
  const bySource = rate((a) => (a.ps_jobs.source === "jobtech" ? "Platsbanken" : a.ps_jobs.source.startsWith("company") ? "Career page" : a.ps_jobs.source === "target" ? "Target list" : a.ps_jobs.source));
  const byCv = rate((a) => a.cv_version);
  const replyDays = sent.filter((a) => a.replied_at).map((a) => (new Date(a.replied_at).getTime() - new Date(a.applied_at).getTime()) / 86_400_000).sort((x, y) => x - y);
  const median = replyDays.length ? Math.round(replyDays[Math.floor(replyDays.length / 2)]) : null;
  let insight = `${sent.length} of 20 sent applications before Persephone can say which strength gets the most replies.`;
  if (sent.length >= 20 && byGift.length > 1) {
    const [best, b] = byGift[0];
    const avg = sent.filter(replied).length / sent.length || 0.0001;
    insight = `${best} roles reply ${Math.max(1, Math.round((b.r / b.n) / avg * 10) / 10)}x as often as average. This week's mix shifts toward them.`;
  }
  const Table = ({ title, data }: { title: string; data: [string, { n: number; r: number }][] }) => (
    <div>
      <p className="text-xs text-muted mb-1">{title}</p>
      {data.length ? data.slice(0, 5).map(([k, v]) => <p key={k} className="text-sm num flex justify-between gap-3"><span className="truncate">{k}</span><span>{Math.round((v.r / v.n) * 100)}% of {v.n}</span></p>) : <p className="text-sm text-muted">No data yet</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl">Applications</h1>
        <p className="text-muted text-sm mt-1">Drag a card to move it. Persephone marks Sent only when you press &ldquo;I sent it&rdquo; or when the daily Gmail read sees the draft has gone out.</p>
      </header>
      <section className="card p-4 md:p-5">
        <h2 className="display text-2xl">Insights</h2>
        <p className="mt-1">{insight}</p>
        <div className="grid gap-4 md:grid-cols-5 mt-4">
          <Table title="Reply rate by strength" data={byGift} />
          <Table title="By role family" data={byFam} />
          <Table title="By source" data={bySource} />
          <Table title="By CV version" data={byCv} />
          <div><p className="text-xs text-muted mb-1">Median days to reply</p><p className="num text-3xl">{median ?? "-"}</p></div>
        </div>
      </section>
      <Board rows={rows} pro={pro} />
    </div>
  );
}
