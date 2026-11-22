import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/admin";
import ScoreRing from "@/components/cockpit/ScoreRing";
import { FAMILY, sek, days } from "@/lib/cockpit/format";
import Editor from "./Editor";

export const metadata = { title: "Job" };

const QUESTIONS: Record<string, string[]> = {
  "1": ["Walk me through an automation you built end to end.", "How do you decide what to automate first?", "How do you test an LLM feature before it ships?", "Tell me about a production bug you fixed under pressure.", "How would you roll out an internal AI tool to a skeptical team?"],
  "2": ["How would you fix weak conversion signal for Smart Bidding?", "Explain server-side tagging to a marketer.", "How do you measure incrementality?", "What would you check first in a broken GA4 setup?", "How do you work with media buyers and engineers at once?"],
  "3": ["How do you explain a technical product to a non-technical customer?", "Tell me about a customer you brought from setup to daily use.", "How do you handle a demo that breaks live?", "What do you do in your first two weeks with a new customer?", "How do you feed customer pain back to product?"],
  "4": ["Show me a piece of content you made and why it worked.", "How do you plan a month of social content?", "How do you use AI in your creative process?", "How do you work with brand guidelines?", "What would you change in our content today?"],
  "5": ["How do you handle a borderline policy case?", "How do you keep quality high at volume?", "Tell me about a process fix you made that others adopted.", "How do you protect your own wellbeing in T&S work?", "How would you spot a new abuse pattern early?"],
  "6": ["How would you scope an AI pilot for a client?", "Tell me about turning analysis into a decision.", "How do you work with a skeptical stakeholder?", "How do you estimate ROI for an AI use case?", "What makes an AI project fail?"],
};

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const esc = terms.filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return text;
  const re = new RegExp(`\\b(${esc.join("|")})\\b`, "gi");
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(re, '<mark class="bg-green/20 text-green rounded px-0.5">$1</mark>');
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = db();
  const { data: job } = await sb.from("ps_v_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const [{ data: matches }, { data: skills }, { data: app }, { data: cvs }, { data: gifts }, { data: company }] = await Promise.all([
    sb.from("ps_matches").select("*").eq("job_id", id),
    sb.from("ps_job_skills").select("skill_name,importance,years_required").eq("job_id", id),
    sb.from("ps_applications").select("*").eq("job_id", id).maybeSingle(),
    sb.from("ps_cv_versions").select("code,name,lead_line,family,register").not("family", "is", null).order("code"),
    sb.from("ps_gifts").select("id,name,professional_language,story_ids"),
    job.company_id ? sb.from("ps_companies").select("*").eq("id", job.company_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  const { data: drafts } = app ? await sb.from("ps_drafts").select("*").eq("application_id", app.id) : { data: [] as any[] };
  const c = matches?.find((m: any) => m.method === "crosstrees_v1");
  const v = matches?.find((m: any) => m.method === "vetlandajobb_v1");
  const gr = c?.gift_read ?? v?.gift_read;
  const pro = (gid?: string) => gifts?.find((g: any) => g.id === gid)?.professional_language?.slice(0, 2).join(", ");
  const fam = c?.family_id ?? job.family_id ?? "1";
  const giftIds = [gr?.primary_gift, gr?.secondary_gift, ...(gr?.gifts_called_for ?? []).map((x: any) => x.gift)].filter(Boolean);
  const { data: stories } = await sb.from("ps_stories").select("title,pro_title,situation,action,result,number,gift_id,role_families").not("gift_id", "is", null);
  const top3 = (stories ?? []).sort((a: any, b: any) => (giftIds.indexOf(a.gift_id) + 1 || 9) - (giftIds.indexOf(b.gift_id) + 1 || 9) || (b.role_families?.includes(fam) ? 1 : 0) - (a.role_families?.includes(fam) ? 1 : 0)).slice(0, 3);
  const { data: facts } = await sb.from("ps_facts").select("id,text").in("id", (drafts ?? []).flatMap((d: any) => d.fact_ids ?? []));
  const matched = [...(c?.matched ?? []), ...(v?.matched ?? [])];
  const desc = job.full_description ?? job.description ?? "";
  const d = days(job.deadline);
  const { data: learning } = await sb.from("ps_skills").select("name,gap_note").eq("learning_target", true);
  const gapNotes = (learning ?? []).filter((l: any) => new RegExp(l.name.split(" ")[0], "i").test(`${desc} ${(skills ?? []).map((s: any) => s.skill_name).join(" ")}`) || fam === "5");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="space-y-4 min-w-0">
        <div>
          <p className="text-sm text-muted">{job.company_name} · {job.location || "Stockholm"} · {job.employment_type ?? "Permanent, full-time"}</p>
          <h1 className="display text-3xl md:text-4xl mt-1">{job.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            {job.url ? <a className="btn btn-ghost" href={job.url} target="_blank" rel="noreferrer">Original ad</a> : null}
            {d != null ? <span className={`chip num ${d <= 3 ? "chip-pom" : ""}`}>Deadline {job.deadline} · {d} days</span> : <span className="chip">{job.status === "rolling" ? "Rolling" : "No deadline listed"}</span>}
            {company?.is_big_company ? <span className="chip chip-gold">Big company +10</span> : null}
            {company?.contact_name ? <span className="chip">Contact: {company.contact_name} {company.contact_email ? `(${company.contact_email})` : ""}</span> : null}
          </div>
        </div>
        <article className="card p-4 md:p-5 text-sm leading-relaxed whitespace-pre-wrap max-h-[70vh] overflow-auto" dangerouslySetInnerHTML={{ __html: highlight(desc || "The full ad text is not stored yet. Open the original ad.", matched) }} />
      </section>

      <section className="space-y-4 min-w-0">
        <div className="card p-4 md:p-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={c?.score != null ? Number(c.score) : null} low={c?.ci_low} high={c?.ci_high} size={92} />
            <div className="text-sm space-y-1 num">
              <p><b>crosstrees_v1</b> {c ? `${Math.round(c.score)} (95% CI ${c.ci_low}–${c.ci_high})` : "not scored yet"}</p>
              <p><b>vetlandajobb_v1</b> {v ? Math.round(v.score) : "-"}</p>
              <p className="text-muted">Final rank {c?.rank_score ?? v?.rank_score ?? "-"} · {FAMILY[fam]} · {sek(c?.salary_estimate_min ?? job.salary_min, c?.salary_estimate_max ?? job.salary_max)}</p>
              {c?.years_gap ? <p className="text-amber">Years gap: {c.years_gap}</p> : null}
            </div>
          </div>
          {c?.why ? <p className="text-sm text-muted mt-3">{c.why}</p> : null}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(c?.matched ?? v?.matched ?? []).map((s: string) => <span key={s} className="chip chip-green">{s}</span>)}
            {(c?.missing_required ?? []).map((s: string) => <span key={s} className="chip chip-amber">{s}</span>)}
            {(c?.missing_preferred ?? []).map((s: string) => <span key={s} className="chip">{s}</span>)}
          </div>
          {gr ? (
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <p><span className="text-muted">Primary strength:</span> <b>{pro(gr.primary_gift)}</b> <span className="text-muted">· secondary:</span> {pro(gr.secondary_gift)} <span className="text-muted num">· fit {Math.round((gr.gift_fit ?? 0) * 100)}%</span></p>
              <ul className="mt-2 space-y-1 text-muted">
                {(gr.gifts_called_for ?? []).slice(0, 4).map((g: any, i: number) => <li key={i}>&ldquo;{g.evidence_in_ad}&rdquo; → {pro(g.gift)}</li>)}
              </ul>
            </div>
          ) : null}
          {gapNotes.length ? <div className="mt-3 space-y-1">{gapNotes.map((g: any) => <p key={g.name} className="text-xs text-amber">Gap: {g.name}. {g.gap_note}</p>)}</div> : null}
          {skills?.length ? <p className="text-xs text-muted mt-3">Ad skills: {skills.map((s: any) => `${s.skill_name} (${s.importance}${s.years_required ? `, ${s.years_required}y` : ""})`).join(", ")}</p> : null}
        </div>

        <Editor jobId={id} app={app} drafts={drafts ?? []} cvs={cvs ?? []} facts={facts ?? []} />

        <div className="card p-4 md:p-5">
          <h2 className="display text-2xl">Interview prep</h2>
          <div className="mt-3 space-y-3">
            {top3.map((s: any) => (
              <div key={s.title} className="raised rounded-xl p-3 text-sm">
                <p className="font-medium">{s.pro_title ?? s.title} <span className="chip chip-gold ml-1 num">{s.number}</span></p>
                <p className="text-muted mt-1">{s.situation} {s.action} {s.result}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-4 text-sm text-muted">Likely questions</h3>
          <ol className="list-decimal pl-5 text-sm mt-1 space-y-1">{(QUESTIONS[fam] ?? QUESTIONS["1"]).map((q) => <li key={q}>{q}</li>)}</ol>
          <p className="text-sm mt-3">Salary: &ldquo;Based on the role, I&apos;m looking at 50,000 to 55,000 per month.&rdquo;</p>
          {app ? <a href={`/app/interviews/${app.id}`} className="btn btn-ghost mt-3">Open full prep and practice</a> : null}
        </div>
      </section>
    </div>
  );
}
