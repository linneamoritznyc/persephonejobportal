"use client";
import { useMemo, useState, useTransition } from "react";
import { saveExperience, saveFact, saveGiftEvidence, saveCvSummary } from "../actions";
import { findBannedTerm, lintStyle } from "@/lib/guard";

const TABS = ["Portfolio cards", "Facts", "Stories", "CVs", "Strengths", "Skills", "Rules"] as const;

export default function Mirror(p: { exps: any[]; facts: any[]; stories: any[]; cvs: any[]; rules: any[]; gifts: any[]; skills: any[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Portfolio cards");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>)}</div>
      {msg ? <p className="text-sm text-gold">{msg}</p> : null}
      {tab === "Portfolio cards" ? <Cards exps={p.exps} gifts={p.gifts} onSave={(id, patch) => start(async () => { const r = await saveExperience(id, patch); say(r.ok ? "Saved. The public portfolio updates in seconds." : r.error); })} /> : null}
      {tab === "Facts" ? <Facts facts={p.facts} onSave={(id, t) => start(async () => { const r = await saveFact(id, t); say(r.ok ? "Fact saved." : r.error); })} /> : null}
      {tab === "Stories" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {p.stories.filter((s) => !s.tags?.includes("practice")).map((s) => (
            <div key={s.id} className="card p-4 text-sm">
              <p className="font-medium">{s.pro_title ?? s.title} {s.number ? <span className="chip chip-gold num ml-1">{s.number}</span> : null} {s.tags?.includes("legacy") ? <span className="chip ml-1">legacy</span> : null}</p>
              <p className="text-muted mt-1">{s.spoken_60s ?? [s.situation, s.action, s.result].filter(Boolean).join(" ")}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "CVs" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {p.cvs.map((c) => (
            <form key={c.code} className="card p-4 space-y-2" action={(fd) => start(async () => { const r = await saveCvSummary(c.code, String(fd.get("s"))); say(r.ok ? `Saved ${c.code}` : `${r.error} ${(r as any).sentence ?? ""}`); })}>
              <p className="font-medium">{c.code}: {c.name}</p>
              <input name="s" className="field" defaultValue={c.summary ?? c.lead_line} />
              <div className="flex gap-2">
                <button className="btn btn-ghost">Save summary line</button>
                {c.pdf_path ? <a className="btn btn-ghost" href={`/api/cockpit/cv/${c.code}`} target="_blank" rel="noreferrer">PDF</a> : null}
              </div>
            </form>
          ))}
        </div>
      ) : null}
      {tab === "Strengths" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {p.gifts.map((g) => (
            <form key={g.id} className="card p-4 space-y-2" action={(fd) => start(async () => { const r = await saveGiftEvidence(g.id, String(fd.get("e")).split("\n").map((x) => x.trim()).filter(Boolean)); say(r.ok ? `Saved ${g.name}` : r.error); })}>
              <p className="font-medium">{g.sort}. {g.name} <span className="text-muted text-sm">· {g.essence}</span></p>
              <p className="text-xs text-muted">Outgoing language: {g.professional_language.join(", ")}</p>
              <textarea name="e" className="field min-h-28 text-sm" defaultValue={(g.evidence ?? []).join("\n")} />
              <button className="btn btn-ghost">Save evidence</button>
            </form>
          ))}
        </div>
      ) : null}
      {tab === "Skills" ? (
        <div className="card p-4 flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s.name} className={`chip ${String(s.category).startsWith("legacy") ? "" : "chip-green"}`}>{s.name}</span>)}</div>
      ) : null}
      {tab === "Rules" ? (
        <div className="card p-4 space-y-2 text-sm">
          {p.rules.map((r) => <p key={r.id}><span className="chip mr-2">{r.kind}</span>{r.kind === "banned_term" ? <span className="text-muted">view only: {r.rule}</span> : r.rule}</p>)}
        </div>
      ) : null}
      {pending ? <p className="text-xs text-muted">Saving...</p> : null}
    </div>
  );
}

function Cards({ exps, gifts, onSave }: { exps: any[]; gifts: any[]; onSave: (id: string, patch: any) => void }) {
  const cards = exps.filter((e) => e.card_title || e.show_on_portfolio || e.kind === "project");
  const [pick, setPick] = useState(cards[0]?.id ?? "");
  const [lens, setLens] = useState("");
  const e = cards.find((c) => c.id === pick);
  const [draft, setDraft] = useState<any>({});
  const cur = { ...e, ...draft };
  const live = useMemo(() => {
    const t = `${cur.card_title ?? ""} ${cur.saw ?? ""} ${cur.built ?? ""} ${cur.reached ?? ""}`;
    return { banned: findBannedTerm(t), lint: lintStyle(t) };
  }, [cur.card_title, cur.saw, cur.built, cur.reached]);
  const order = lens ? [...cards].filter((c) => c.show_on_portfolio).sort((a, b) => (a.gift_ids?.indexOf(lens) + 1 || 9) - (b.gift_ids?.indexOf(lens) + 1 || 9)) : cards.filter((c) => c.show_on_portfolio).sort((a, b) => (a.portfolio_order ?? 99) - (b.portfolio_order ?? 99));
  if (!e) return <p className="text-muted">No projects yet.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4 space-y-2">
        <div className="flex gap-2">
          <select className="field" value={pick} onChange={(ev) => { setPick(ev.target.value); setDraft({}); }}>{cards.map((c) => <option key={c.id} value={c.id}>{c.card_title ?? c.org}</option>)}</select>
          <label className="text-sm flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={!!cur.show_on_portfolio} onChange={(ev) => { setDraft((d: any) => ({ ...d, show_on_portfolio: ev.target.checked })); onSave(e.id, { show_on_portfolio: ev.target.checked }); }} /> Show on portfolio</label>
        </div>
        {(["card_title", "saw", "built", "reached"] as const).map((k) => (
          <label key={k} className="block text-sm"><span className="text-muted capitalize">{k.replace("card_", "")}</span>
            <textarea className="field mt-1 min-h-16" value={cur[k] ?? ""} onChange={(ev) => setDraft((d: any) => ({ ...d, [k]: ev.target.value }))} />
          </label>
        ))}
        <p className={`text-sm ${live.banned || live.lint.length ? "text-pom" : "text-green"}`}>{live.banned ? "Banned term found. Saving is blocked." : live.lint.length ? `Style: ${live.lint.join(", ")}` : "Guard: clean"}</p>
        <button className="btn btn-primary" disabled={!!live.banned} onClick={() => onSave(e.id, { card_title: cur.card_title, saw: cur.saw, built: cur.built, reached: cur.reached })}>Save card</button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><span className="text-sm text-muted">Preview as a recruiter with lens</span>
          <select className="field w-auto" value={lens} onChange={(ev) => setLens(ev.target.value)}><option value="">none</option>{gifts.map((g) => <option key={g.id} value={g.id}>{g.professional_language[0]}</option>)}</select>
        </div>
        <article className="rounded-[22px] overflow-hidden bg-white text-[#15131a] border border-[#e6e3ea]">
          <div className="h-24" style={{ background: "linear-gradient(120deg,#c2364b,#2b3fd1 55%,#d9a43c)" }} />
          <div className="p-5 space-y-2">
            <p className="text-sm text-[#5d5a66]">{cur.card_kind}</p>
            <h3 style={{ fontFamily: "Georgia,serif", fontSize: 26 }}>{cur.card_title}</h3>
            <dl className="space-y-1.5 text-[15px]">
              <div className="grid grid-cols-[4.8em_1fr] gap-2"><dt className="font-semibold text-[#c2364b] text-sm">Saw</dt><dd>{cur.saw}</dd></div>
              <div className="grid grid-cols-[4.8em_1fr] gap-2"><dt className="font-semibold text-[#2b3fd1] text-sm">Built</dt><dd>{cur.built}</dd></div>
              <div className="grid grid-cols-[4.8em_1fr] gap-2"><dt className="font-semibold text-[#d9a43c] text-sm">Reached</dt><dd className="font-medium">{cur.reached}</dd></div>
            </dl>
          </div>
        </article>
        <p className="text-xs text-muted">Card order on / with this lens: {order.map((c) => c.card_title).join(" · ")}</p>
      </div>
    </div>
  );
}

function Facts({ facts, onSave }: { facts: any[]; onSave: (id: string, text: string) => void }) {
  const [q, setQ] = useState("");
  const [legacy, setLegacy] = useState(false);
  const list = facts.filter((f) => (legacy || !f.tags?.includes("legacy")) && f.text.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center"><input className="field" placeholder="Search facts" value={q} onChange={(e) => setQ(e.target.value)} /><label className="text-sm flex gap-2 whitespace-nowrap"><input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} /> Show legacy</label></div>
      <p className="text-xs text-muted">{list.length} facts. Letters may only use these.</p>
      {list.slice(0, 150).map((f) => (
        <form key={f.id} className="card p-3 flex gap-2 items-start" action={(fd) => onSave(f.id, String(fd.get("t")))}>
          <span className="chip shrink-0">{f.id}</span>
          <textarea name="t" className="field text-sm min-h-14" defaultValue={f.text} />
          <button className="btn btn-ghost shrink-0">Save</button>
        </form>
      ))}
    </div>
  );
}
