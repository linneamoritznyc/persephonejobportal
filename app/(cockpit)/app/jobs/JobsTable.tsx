"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftJob, draftMany, skipJob, saveForLater, addJobByUrl } from "../actions";
import { FAMILY, sek, days } from "@/lib/cockpit/format";

type Row = any;

export default function JobsTable({ rows, giftNames, initialGift, mode }: { rows: Row[]; giftNames: Record<string, string>; initialGift: string; mode: "ai" | "local" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fam, setFam] = useState("");
  const [wave, setWave] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [gift, setGift] = useState(initialGift);
  const [min, setMin] = useState(0);
  const [matchesOnly, setMatchesOnly] = useState(mode === "ai");
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState<"score" | "deadline" | "newest">("score");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 4000);
  };

  const list = useMemo(() => {
    const t = q.toLowerCase();
    const r = rows.filter((j) => {
      if (t && !`${j.title} ${j.company_name} ${j.location}`.toLowerCase().includes(t)) return false;
      if (fam && j.family_id !== fam) return false;
      if (wave && j.wave !== wave) return false;
      if (status && (j.app_status ?? j.status) !== status) return false;
      if (gift && j.primary_gift !== gift) return false;
      if (source === "platsbanken" && j.source !== "jobtech") return false;
      if (source === "careers" && !j.source.startsWith("company:")) return false;
      if (source === "discovery" && !String(j.found_by_term ?? "").startsWith("discovery:")) return false;
      if (source === "targets" && j.source !== "target") return false;
      if (source === "us" && j.track !== "us") return false;
      if (min && (j.score ?? 0) < min) return false;
      if (matchesOnly && j.source !== "target" && (j.rank ?? 0) < 55) return false;
      if (soon) {
        const d = days(j.deadline);
        if (d == null || d > 7) return false;
      }
      return true;
    });
    return r.sort((a, b) =>
      sort === "deadline" ? String(a.deadline ?? "9999").localeCompare(String(b.deadline ?? "9999")) : sort === "newest" ? String(b.first_seen_at).localeCompare(String(a.first_seen_at)) : (b.rank ?? -1) - (a.rank ?? -1)
    );
  }, [rows, q, fam, wave, status, gift, source, min, soon, sort, matchesOnly]);

  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="space-y-4">
      <div className="card p-3 md:p-4 flex flex-col md:flex-row gap-2">
        <input className="field flex-1" placeholder="Paste any job link (Teamtailor, Greenhouse, Lever, Ashby or any page)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn btn-primary" disabled={pending || !url} onClick={() => start(async () => {
          const r = await addJobByUrl(url);
          if (r.ok) { setUrl(""); say("Added and scored."); router.push(`/app/jobs/${r.jobId}`); } else say(r.error);
        })}>{pending ? "Working..." : "Add a job"}</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="field md:w-64" placeholder="Search title or company" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field w-auto" value={fam} onChange={(e) => setFam(e.target.value)}><option value="">All families</option>{Object.entries(FAMILY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="field w-auto" value={wave} onChange={(e) => setWave(e.target.value)}><option value="">All waves</option>{["1", "2", "3", "later"].map((w) => <option key={w} value={w}>Wave {w}</option>)}</select>
        <select className="field w-auto" value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option><option value="targets">My target list</option><option value="platsbanken">Platsbanken</option><option value="careers">Career pages</option><option value="discovery">Kompetensgrafen discovery</option><option value="us">US consulting</option></select>
        <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{["open", "check", "rolling", "deadline", "shortlisted", "drafted", "sent"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="field w-auto" value={gift} onChange={(e) => setGift(e.target.value)}><option value="">Any strength</option>{Object.entries(giftNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="text-sm text-muted flex items-center gap-2">Min score <input type="number" className="field w-20" value={min} onChange={(e) => setMin(+e.target.value)} /></label>
        <label className="text-sm text-muted flex items-center gap-2"><input type="checkbox" checked={matchesOnly} onChange={(e) => setMatchesOnly(e.target.checked)} /> Good matches only</label>
        <label className="text-sm text-muted flex items-center gap-2"><input type="checkbox" checked={soon} onChange={(e) => setSoon(e.target.checked)} /> Closing in 7 days</label>
        <select className="field w-auto ml-auto" value={sort} onChange={(e) => setSort(e.target.value as any)}><option value="score">Sort: score</option><option value="deadline">Sort: deadline</option><option value="newest">Sort: newest</option></select>
      </div>

      {sel.size ? (
        <div className="card p-3 flex items-center gap-3 sticky top-2 z-10">
          <span className="text-sm">{sel.size} selected</span>
          <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
            const r = await draftMany([...sel]);
            say(r.ok ? `Drafted ${r.done}${r.failed ? `, ${r.failed} failed` : ""}.` : r.error);
            setSel(new Set());
            router.refresh();
          })}>{pending ? "Drafting..." : "Draft all selected"}</button>
          <button className="btn btn-ghost" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      ) : null}

      <p className="text-xs text-muted">{list.length} jobs</p>
      <div className="space-y-2">
        {list.slice(0, 200).map((j) => {
          const d = days(j.deadline);
          return (
            <div key={j.id} className="card p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <input type="checkbox" className="mt-1.5" checked={sel.has(j.id)} onChange={() => toggle(j.id)} aria-label={`Select ${j.title}`} />
                <div className="num w-14 shrink-0 text-center">
                  <div className="text-xl font-semibold">{j.rank != null ? Math.round(j.rank) : "-"}</div>
                  <div className="text-[10px] text-muted">final</div>
                </div>
                <div className="min-w-0">
                  <Link href={`/app/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                  <p className="text-xs text-muted mt-0.5">{j.company_name} · {j.location || "Stockholm"} · {j.employment_type ?? "Permanent, full-time"}{j.track === "us" ? " · US" : ""}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {j.wave ? <span className="chip chip-gold">Wave {j.wave}</span> : null}
                    {j.family_id ? <span className="chip">{FAMILY[j.family_id]}</span> : null}
                    {j.primary_gift ? <span className="chip">{giftNames[j.primary_gift]}</span> : null}
                    <span className="chip num">crosstrees {j.score != null ? Math.round(j.score) : "-"}{j.ci_low != null ? ` [${j.ci_low}–${j.ci_high}]` : ""}</span>
                    <span className="chip num">vetlandajobb {j.vetlanda ?? "-"}</span>
                    {sek(j.salary_min, j.salary_max) ? <span className="chip num">{sek(j.salary_min, j.salary_max)}</span> : null}
                    {d != null ? <span className={`chip num ${d <= 3 ? "chip-pom" : ""}`}>{d} days left</span> : null}
                    {j.app_status ? <span className="chip chip-green">{j.app_status}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 md:ml-auto">
                <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await draftJob(j.id); say(r.ok ? "Draft written. Open the job to review it." : r.error); router.refresh(); })}>Draft it</button>
                <button className="btn btn-ghost" onClick={() => start(async () => { await saveForLater(j.id); say("Saved for later."); router.refresh(); })}>Save</button>
                <button className="btn btn-ghost" onClick={() => start(async () => { await skipJob(j.id); say("Skipped for good."); router.refresh(); })}>Skip</button>
              </div>
            </div>
          );
        })}
      </div>
      {toast ? <div role="status" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 card px-4 py-3 text-sm shadow-xl z-30">{toast}</div> : null}
    </div>
  );
}
