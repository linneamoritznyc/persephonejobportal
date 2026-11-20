import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/admin";
import Practice from "./Practice";

export const metadata = { title: "Interview prep" };

export default async function Interview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = db();
  const { data: app } = await sb.from("ps_applications").select("*,ps_jobs(id,title,company_name,family_id)").eq("id", id).maybeSingle();
  if (!app) notFound();
  const { data: m } = await sb.from("ps_matches").select("gift_read,family_id").eq("job_id", app.job_id).eq("method", "crosstrees_v1").maybeSingle();
  const { data: gifts } = await sb.from("ps_gifts").select("id,professional_language");
  const { data: stories } = await sb.from("ps_stories").select("*").not("gift_id", "is", null);
  const gr: any = m?.gift_read ?? {};
  const top = [...new Set([gr.primary_gift, gr.secondary_gift, ...(gr.gifts_called_for ?? []).map((x: any) => x.gift)].filter(Boolean))].slice(0, 3) as string[];
  const pick = top.length ? top : ["mercy", "stewardship", "interpretation"];
  const chosen = pick.map((g) => stories?.find((s: any) => s.gift_id === g)).filter(Boolean);
  const pro = (g: string) => gifts?.find((x: any) => x.id === g)?.professional_language?.slice(0, 2).join(", ");
  const job: any = app.ps_jobs;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">{job.company_name}</p>
        <h1 className="display text-4xl">Interview prep: {job.title}</h1>
      </header>
      <section className="card p-4 md:p-5">
        <h2 className="display text-2xl">What this role calls for</h2>
        <div className="flex flex-wrap gap-2 mt-2">{pick.map((g) => <span key={g} className="chip chip-gold">{pro(g)}</span>)}</div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {chosen.map((s: any) => (
          <div key={s.id} className="card p-4 text-sm">
            <p className="font-medium">{s.pro_title}</p>
            <p className="mt-2 leading-relaxed">{s.spoken_60s}</p>
            <p className="chip chip-gold num mt-2">{s.number}</p>
          </div>
        ))}
      </section>
      <section className="card p-4 md:p-5 text-sm space-y-2">
        <p><b>Salary:</b> &ldquo;Based on the role, I&apos;m looking at 50,000 to 55,000 per month.&rdquo;</p>
        <p><b>Stability:</b> &ldquo;I want one team and one product for years.&rdquo;</p>
        <p><b>Opening:</b> I see what others miss, I build the fix end to end, and I bring people in to use it.</p>
      </section>
      <Practice applicationId={id} />
    </div>
  );
}
