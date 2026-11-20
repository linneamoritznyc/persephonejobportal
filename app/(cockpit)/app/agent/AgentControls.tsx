"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pauseCron, toggleSource, saveFamilyKeywords } from "../actions";

export default function AgentControls({ paused, sources, families }: { paused: boolean; sources: any[]; families: any[] }) {
  const router = useRouter();
  const [dry, setDry] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      setMsg("Running. This takes up to 5 minutes...");
      const r = await fetch("/api/cockpit/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dryRun: dry }) });
      const d = await r.json();
      setMsg(r.ok ? `Done: ${d.jobs_found} found, ${d.jobs_new} new, ${d.matches_created} scored, ${d.drafts_created} drafts, ${d.gmail_drafts} in Gmail.` : d.error);
      router.refresh();
    });
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="card p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={pending} onClick={run}>{pending ? "Running..." : "Run now"}</button>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} /> Dry run (drafts go to Persephone/Test)</label>
        </div>
        <button className="btn btn-ghost" onClick={() => start(async () => { await pauseCron(!paused); router.refresh(); })}>{paused ? "Resume the daily run" : "Pause the daily run"}</button>
        {msg ? <p className="text-sm text-muted">{msg}</p> : null}
        <div className="border-t border-line pt-3 space-y-2">
          <p className="text-xs text-muted">Sources</p>
          {sources.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked={s.enabled} onChange={(e) => start(async () => { await toggleSource(s.id, e.target.checked); })} />
              {s.name}
              <span className="ml-auto text-xs text-muted num">{s.last_run_at ? `${s.last_status}, ${s.last_count ?? 0} jobs` : "not run yet"}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="card p-4 md:p-5 space-y-3">
        <p className="text-xs text-muted">Role family keywords (comma separated)</p>
        {families.map((f) => (
          <form key={f.id} className="space-y-1" action={(fd) => start(async () => { await saveFamilyKeywords(f.id, String(fd.get("en")), String(fd.get("sv"))); setMsg(`Saved ${f.name}`); })}>
            <p className="text-sm">{f.id}. {f.name}</p>
            <input name="en" className="field text-xs" defaultValue={(f.keywords_en ?? []).join(", ")} />
            <div className="flex gap-2"><input name="sv" className="field text-xs" defaultValue={(f.keywords_sv ?? []).join(", ")} /><button className="btn btn-ghost">Save</button></div>
          </form>
        ))}
      </div>
    </section>
  );
}
