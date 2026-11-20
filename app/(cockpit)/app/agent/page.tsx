import { db } from "@/lib/supabase/admin";
import AgentControls from "./AgentControls";
import { draftsConfigured } from "@/lib/mail/imapDraft";

export const metadata = { title: "Agent" };

async function deployment() {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  try {
    const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
    const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${project}&limit=1&target=production${team}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const d = await r.json();
    return d.deployments?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function Agent() {
  const sb = db();
  const [{ data: runs }, { data: sources }, { data: families }, { data: settings }, { data: brief }, dep] = await Promise.all([
    sb.from("ps_agent_runs").select("*").order("started_at", { ascending: false }).limit(30),
    sb.from("ps_sources").select("*").order("id"),
    sb.from("ps_role_families").select("*").order("id"),
    sb.from("ps_settings").select("*"),
    sb.from("ps_drafts").select("subject,body,created_at").eq("kind", "morning_brief").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    deployment(),
  ]);
  const paused = settings?.find((s: any) => s.key === "cron_paused")?.value === true;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl">Agent</h1>
        <p className="text-muted text-sm mt-1">Runs every day at 06:30 Stockholm time. Drafts only: Persephone never sends email. Gmail drafts: {draftsConfigured() ? "on" : "off until the app password is added"}.</p>
        {dep ? <p className="text-xs text-muted mt-1">Deployment: {dep.state ?? dep.readyState} · {new Date(dep.created).toLocaleString("en-GB")} · {dep.url}</p> : null}
      </header>
      <AgentControls paused={paused} sources={sources ?? []} families={families ?? []} />
      {brief ? (
        <section className="card p-4 md:p-5">
          <h2 className="display text-2xl">{brief.subject}</h2>
          <pre className="whitespace-pre-wrap text-sm mt-2 font-sans">{brief.body}</pre>
        </section>
      ) : null}
      <section className="card p-4 md:p-5 overflow-x-auto">
        <h2 className="display text-2xl">Last 30 runs</h2>
        <table className="w-full text-sm mt-3 num">
          <thead className="text-muted text-xs text-left">
            <tr><th className="py-1">Started</th><th>Trigger</th><th>Status</th><th>Found</th><th>New</th><th>Scored</th><th>Drafts</th><th>Gmail</th><th>Guard</th><th>Cost</th><th>Errors</th></tr>
          </thead>
          <tbody>
            {(runs ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-2 pr-2 whitespace-nowrap">{new Date(r.started_at).toLocaleString("en-GB", { timeZone: "Europe/Stockholm" })}</td>
                <td>{r.trigger}{r.dry_run ? " (dry)" : ""}</td>
                <td>{r.status}</td>
                <td>{r.jobs_found}</td><td>{r.jobs_new}</td><td>{r.matches_created}</td><td>{r.drafts_created}</td><td>{r.gmail_drafts}</td><td>{r.guard_rejections}</td>
                <td>${Number(r.cost_usd).toFixed(3)}</td>
                <td className="max-w-xs"><details><summary className="cursor-pointer text-muted">{(r.errors ?? []).length} errors, log</summary><pre className="whitespace-pre-wrap text-xs mt-1 font-sans">{[...(r.log ?? []), ...(r.errors ?? [])].join("\n")}</pre></details></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
