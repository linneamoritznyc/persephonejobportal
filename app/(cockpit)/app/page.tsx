import Link from "next/link";
import { db } from "@/lib/supabase/admin";
import ScoreRing from "@/components/cockpit/ScoreRing";
import { FAMILY, sek, days } from "@/lib/cockpit/format";
import { unreadDraftCount, draftsAccount } from "@/lib/mail/imapDraft";
import { getMode, MODES } from "@/lib/mode";

export const metadata = { title: "Today" };

export default async function Today() {
  const sb = db();
  const mode = await getMode();
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const [plan, deadlines, top, pipeline, gifts, weekly, draftsWaiting] = await Promise.all([
    sb.from("ps_events").select("title,due_date,detail").eq("kind", "plan").order("due_date"),
    sb.from("ps_matches").select("rank_score,ps_jobs!inner(id,title,company_name,deadline,is_open,blocked_reason)").eq("method", "crosstrees_v1").gte("rank_score", 55).eq("ps_jobs.mode", mode).eq("ps_jobs.is_open", true).is("ps_jobs.blocked_reason", null).gte("ps_jobs.deadline", today).lte("ps_jobs.deadline", in3),
    sb.from("ps_matches").select("score,ci_low,ci_high,rank_score,why,primary_gift,salary_estimate_min,salary_estimate_max,family_id,ps_jobs!inner(id,title,company_name,location,employment_type,deadline,is_open,blocked_reason,status,mode)").eq("method", "crosstrees_v1").eq("ps_jobs.mode", mode).eq("ps_jobs.is_open", true).is("ps_jobs.blocked_reason", null).neq("ps_jobs.status", "closed").order("rank_score", { ascending: false }).limit(5),
    sb.from("ps_applications").select("status,ps_jobs!inner(mode)").eq("ps_jobs.mode", mode),
    sb.from("ps_gifts").select("id,name,professional_language").order("sort"),
    sb.from("ps_applications").select("applied_at").not("applied_at", "is", null),
    unreadDraftCount().catch(() => null),
  ]);
  const vets = await sb.from("ps_matches").select("job_id,score").eq("method", "vetlandajobb_v1").in("job_id", (top.data ?? []).map((m: any) => m.ps_jobs.id));
  const vmap = new Map((vets.data ?? []).map((v: any) => [v.job_id, v.score]));
  const planDay = plan.data?.find((p: any) => p.due_date === today) ?? plan.data?.find((p: any) => p.due_date > today) ?? null;
  const count = (s: string[]) => (pipeline.data ?? []).filter((a: any) => s.includes(a.status)).length;
  const strip = [
    ["Found", (await sb.from("ps_v_jobs").select("id", { count: "exact", head: true }).eq("is_open", true).eq("mode", mode)).count ?? 0],
    ["Drafted", count(["drafted"])],
    ["Sent", count(["sent"])],
    ["Interview", count(["interview"])],
    ["Offer", count(["offer"])],
  ] as const;
  const { data: weekMatches } = await sb.from("ps_matches").select("primary_gift").eq("method", "crosstrees_v1").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const giftCount = (id: string) => (weekMatches ?? []).filter((m: any) => m.primary_gift === id).length;
  const pro = (id?: string | null) => gifts.data?.find((g: any) => g.id === id)?.professional_language?.[0];
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
  const weeks = new Map<string, number>();
  for (const a of weekly.data ?? []) {
    const d = new Date(a.applied_at);
    const k = `${d.getUTCFullYear()}-${Math.ceil((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 604_800_000)}`;
    weeks.set(k, (weeks.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted text-sm">{date}</p>
        <h1 className="display text-4xl md:text-5xl mt-1">{mode === "local" ? "God morgon, Linnea." : "Good morning, Linnea."}</h1>
        <p className="text-muted text-sm mt-1">{MODES[mode].label}: {MODES[mode].blurb}</p>
        {planDay ? (
          <div className="card mt-5 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3">
            <span className="chip chip-gold num">Day {planDay.detail?.day} of 10</span>
            <p className="text-sm md:text-base">{planDay.title.replace(/^Day \d+: /, "")}</p>
            <span className="md:ml-auto text-xs text-muted">Done when: {planDay.detail?.done_when}</span>
          </div>
        ) : null}
      </header>

      {(deadlines.data ?? []).length ? (
        <section className="card border-pom/60 p-4 md:p-5">
          <h2 className="display text-2xl text-pom">Closing within 3 days</h2>
          <ul className="mt-3 divide-y divide-line">
            {(deadlines.data ?? []).map((d: any) => d.ps_jobs).sort((a: any, b: any) => a.deadline.localeCompare(b.deadline)).map((j: any) => (
              <li key={j.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/app/jobs/${j.id}`} className="hover:underline">{j.company_name}, {j.title}</Link>
                <span className="ml-auto chip chip-pom num">{days(j.deadline)} days</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {strip.map(([label, n]) => (
          <div key={label} className="card p-4">
            <p className="text-muted text-xs">{label}</p>
            <p className="num text-3xl font-semibold mt-1">{n}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="display text-3xl">Top matches</h2>
          <Link href="/app/jobs" className="text-sm text-muted hover:text-ink">All jobs</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(top.data ?? []).length === 0 ? <p className="text-muted">The agent fills this at 06:30. Press Run now on the Agent page to fill it sooner.</p> : null}
          {(top.data ?? []).map((m: any) => (
            <Link key={m.ps_jobs.id} href={`/app/jobs/${m.ps_jobs.id}`} className="card p-4 flex gap-4 hover:border-silver transition-all duration-200">
              <ScoreRing score={Number(m.score)} low={m.ci_low} high={m.ci_high} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{m.ps_jobs.company_name} · {m.ps_jobs.location ?? "Stockholm"}</p>
                <p className="font-medium mt-0.5 truncate">{m.ps_jobs.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="chip">{m.ps_jobs.employment_type ?? "Permanent, full-time"}</span>
                  {pro(m.primary_gift) ? <span className="chip chip-gold">{pro(m.primary_gift)}</span> : null}
                  {m.family_id ? <span className="chip">{FAMILY[m.family_id]}</span> : null}
                </div>
                <p className="text-xs text-muted mt-2 num">
                  Final {m.rank_score} · crosstrees {Math.round(m.score)} [{m.ci_low}–{m.ci_high}] · vetlandajobb {vmap.get(m.ps_jobs.id) ?? "-"} · {sek(m.salary_estimate_min, m.salary_estimate_max)}
                  {m.ps_jobs.deadline ? ` · closes ${m.ps_jobs.deadline}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3">
        <div>
          <h2 className="display text-2xl">Drafts waiting</h2>
          <p className="text-sm text-muted">{draftsWaiting == null ? "Gmail drafts are off until the app password is added." : `${draftsWaiting} drafts in ${draftsAccount()}`}</p>
        </div>
        <a className="btn btn-primary md:ml-auto" href={`https://mail.google.com/mail/u/?authuser=${draftsAccount()}#drafts`} target="_blank" rel="noreferrer">Open Gmail drafts</a>
      </section>

      <section>
        <h2 className="display text-3xl">Strengths in play</h2>
        <p className="text-sm text-muted">Sized by how many matches each one pulled this week.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(gifts.data ?? []).map((g: any, i: number) => {
            const n = giftCount(g.id);
            const size = 64 + Math.min(n, 12) * 6;
            const colors = ["#C2364B", "#2b3fd1", "#d9a43c", "#4FB38A", "#C9D1E3"];
            return (
              <Link key={g.id} href={`/app/jobs?gift=${g.id}`} title={g.professional_language?.join(", ")} className="relative grid place-items-center text-center text-[11px] leading-tight transition-all duration-200 hover:scale-105" style={{ width: size, height: size }}>
                <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
                  <polygon points={`${10 + (i * 7) % 20},${8 + (i * 3) % 12} 92,${14 + (i * 5) % 20} ${86 - (i * 4) % 14},92 ${6 + (i * 6) % 18},${80 - (i * 2) % 10}`} fill={colors[i % 5]} fillOpacity=".75" />
                </svg>
                <span className="relative px-1 text-white drop-shadow">{g.name.split(" ")[0]}<br /><b className="num">{n}</b></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="display text-2xl">Applications sent per week</h2>
        <Chart points={[...weeks.entries()].sort().slice(-10).map(([, v]) => v)} />
      </section>
    </div>
  );
}

function Chart({ points }: { points: number[] }) {
  if (!points.length) return <p className="text-sm text-muted mt-2">Your first sent application starts this line.</p>;
  const max = Math.max(...points, 1);
  const W = 600, H = 120;
  const xs = points.map((_, i) => (points.length === 1 ? W / 2 : (i * W) / (points.length - 1)));
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs[i]},${H - (p / max) * (H - 10)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32 mt-3" aria-label="Applications sent per week">
      <path d={d} fill="none" stroke="#D9B26A" strokeWidth="2.5" />
      {points.map((p, i) => <circle key={i} cx={xs[i]} cy={H - (p / max) * (H - 10)} r="3.5" fill="#D9B26A" />)}
    </svg>
  );
}
