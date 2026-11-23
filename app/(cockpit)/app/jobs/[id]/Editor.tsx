"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftJob, saveDraftText, rewriteDraft, setCv, saveToGmail, markSent, updateContact, thumbs, checkSwedish } from "../../actions";

const KINDS = [
  ["cover_letter", "Cover letter"],
  ["email", "Email"],
  ["linkedin_note", "LinkedIn"],
  ["follow_up", "Follow-up"],
] as const;

export default function Editor({ jobId, app, drafts, cvs, facts }: { jobId: string; app: any; drafts: any[]; cvs: any[]; facts: { id: string; text: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("cover_letter");
  const [texts, setTexts] = useState<Record<string, string>>(Object.fromEntries(drafts.map((d) => [d.kind, d.body])));
  const [instr, setInstr] = useState("");
  const [toast, setToast] = useState<{ msg: string; bad?: string; link?: string } | null>(null);
  const [lt, setLt] = useState<{ message: string; context: string; replacement?: string }[]>([]);
  const [contact, setContact] = useState({ name: app?.contact_name ?? "", li: app?.contact_linkedin ?? "" });
  const [pending, start] = useTransition();
  const draft = drafts.find((d) => d.kind === kind);
  const text = texts[kind] ?? "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const say = (msg: string, bad?: string, link?: string) => {
    setToast({ msg, bad, link });
    setTimeout(() => setToast(null), 7000);
  };

  if (!app || !drafts.length) {
    return (
      <div className="card p-4 md:p-5">
        <h2 className="display text-2xl">Application</h2>
        <p className="text-sm text-muted mt-1">No draft yet. Persephone writes the cover letter, email and LinkedIn note from your facts.</p>
        <input className="field mt-3" placeholder="Optional instruction, for example: lead with the voice agent" value={instr} onChange={(e) => setInstr(e.target.value)} />
        <button className="btn btn-primary mt-3" disabled={pending} onClick={() => start(async () => { const r = await draftJob(jobId, instr || undefined); r.ok ? router.refresh() : say(r.error); })}>{pending ? "Writing..." : "Draft it"}</button>
        {toast ? <p className="text-sm text-amber mt-2">{toast.msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="card p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="display text-2xl mr-auto">Application</h2>
        <button className="chip" onClick={() => start(async () => { await thumbs(jobId, 1); say("Noted: more like this."); })}>Good match</button>
        <button className="chip" onClick={() => start(async () => { await thumbs(jobId, -1); say("Noted: fewer like this."); })}>Poor match</button>
      </div>

      <label className="block text-sm">
        <span className="text-muted">CV version</span>
        <div className="flex gap-2 mt-1">
          <select className="field" defaultValue={app.cv_version ?? ""} onChange={(e) => start(async () => { await setCv(app.id, e.target.value); router.refresh(); })}>
            {cvs.map((c) => <option key={c.code} value={c.code}>{c.code}: {c.name}</option>)}
          </select>
          <a className="btn btn-ghost" href={`/api/cockpit/cv/${app.cv_version ?? "1S"}`} target="_blank" rel="noreferrer">Preview PDF</a>
        </div>
      </label>

      <div className="flex gap-1 border-b border-line">
        {KINDS.filter(([k]) => texts[k] != null).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-all duration-200 ${kind === k ? "border-pom text-ink" : "border-transparent text-muted"}`}>{label}</button>
        ))}
      </div>

      {draft?.subject ? <p className="text-xs text-muted">Subject: {draft.subject}</p> : null}
      <textarea
        className="field min-h-72 leading-relaxed"
        value={text}
        onChange={(e) => setTexts((t) => ({ ...t, [kind]: e.target.value }))}
        onBlur={() => draft && start(async () => { const r = await saveDraftText(draft.id, text); if (!r.ok) say(r.error, (r as any).sentence); })}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`num ${kind === "linkedin_note" && words > 80 ? "text-pom" : "text-muted"}`}>{words} words{kind === "linkedin_note" ? " / 80" : ""}</span>
        <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(text).then(() => say("Copied."))}>Copy</button>
        {(["shorter", "confident", "swedish", "english"] as const).map((m) => (
          <button key={m} className="btn btn-ghost" disabled={pending || !draft} onClick={() => start(async () => { const r = await rewriteDraft(draft.id, m); r.ok ? setTexts((t) => ({ ...t, [kind]: r.body })) : say(r.error); })}>
            {{ shorter: "Shorter", confident: "More confident", swedish: "Swedish", english: "English" }[m]}
          </button>
        ))}
        <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await checkSwedish(text); r.ok ? (setLt(r.matches), say(r.matches.length ? `${r.matches.length} language notes` : "No language issues found.")) : say(r.error); })}>Check Swedish</button>
      </div>
      {lt.length ? (
        <ul className="text-xs space-y-1">
          {lt.map((m, i) => (
            <li key={i} className="raised rounded-lg p-2">
              <span className="text-amber">{m.message}</span> <span className="text-muted">“{m.context}”</span>
              {m.replacement ? <button className="chip ml-2" onClick={() => setTexts((t) => ({ ...t, [kind]: t[kind].replace(m.context, m.context.replace(/\S+/, m.replacement!)) }))}>Use “{m.replacement}”</button> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input className="field" placeholder="Instruction for a rewrite" value={instr} onChange={(e) => setInstr(e.target.value)} />
        <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await draftJob(jobId, instr || undefined); r.ok ? router.refresh() : say(r.error); })}>Regenerate</button>
      </div>

      {facts.length ? (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Cited facts ({facts.length})</summary>
          <ul className="mt-2 space-y-1">{facts.map((f) => <li key={f.id}><b className="text-ultra">{f.id}</b> {f.text}</li>)}</ul>
        </details>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <input className="field" placeholder="Contact name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} onBlur={() => updateContact(app.id, contact.name, contact.li)} />
        <input className="field" placeholder="Contact LinkedIn URL" value={contact.li} onChange={(e) => setContact((c) => ({ ...c, li: e.target.value }))} onBlur={() => updateContact(app.id, contact.name, contact.li)} />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await saveToGmail(app.id);
          r.ok ? say("Draft saved. Open Gmail to send.", undefined, "https://mail.google.com/mail/u/?authuser=linneamoritzcv@gmail.com#drafts") : say(r.error, (r as any).sentence);
        })}>{pending ? "Saving..." : "Save to Gmail drafts"}</button>
        <button className="btn btn-ghost" disabled={pending || app.status === "sent"} onClick={() => start(async () => { await markSent(app.id); say("Marked sent. A follow-up draft is ready for day 5."); router.refresh(); })}>{app.status === "sent" ? "Sent" : "I sent it"}</button>
      </div>

      {toast ? (
        <div role="status" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 card px-4 py-3 text-sm shadow-xl z-30 max-w-md">
          <p>{toast.msg} {toast.link ? <a className="underline text-gold" href={toast.link} target="_blank" rel="noreferrer">Open Gmail</a> : null}</p>
          {toast.bad ? <p className="mt-1 text-pom">“{toast.bad}”</p> : null}
        </div>
      ) : null}
    </div>
  );
}
