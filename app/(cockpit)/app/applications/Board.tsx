"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { moveApplication } from "../actions";
import { ago } from "@/lib/cockpit/format";

const COLS = [
  { id: "drafted", label: "Drafted", match: (a: any) => a.status === "drafted" || a.status === "shortlisted" },
  { id: "sent", label: "Sent", match: (a: any) => a.status === "sent" && !(a.follow_up_at && new Date(a.follow_up_at) <= new Date()) },
  { id: "followup", label: "Follow-up due", match: (a: any) => a.status === "sent" && a.follow_up_at && new Date(a.follow_up_at) <= new Date() },
  { id: "interview", label: "Interview", match: (a: any) => a.status === "interview" },
  { id: "offer", label: "Offer", match: (a: any) => a.status === "offer" },
  { id: "rejected", label: "Closed", match: (a: any) => a.status === "rejected" || a.status === "withdrawn" },
];

export default function Board({ rows, pro }: { rows: any[]; pro: Record<string, string> }) {
  const [items, setItems] = useState(rows);
  const [, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const drop = (col: string) => {
    if (!drag) return;
    const status = col === "followup" ? "sent" : col;
    setItems((xs) => xs.map((a) => (a.id === drag ? { ...a, status, stage_changed_at: new Date().toISOString() } : a)));
    start(async () => { await moveApplication(drag, status); });
    setDrag(null);
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
      {COLS.map((c) => {
        const list = items.filter(c.match);
        return (
          <div key={c.id} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.id)} className="snap-start shrink-0 w-72 card p-3 min-h-64">
            <p className="text-sm font-medium flex justify-between">{c.label}<span className="num text-muted">{list.length}</span></p>
            <div className="mt-3 space-y-2">
              {list.map((a) => (
                <div key={a.id} draggable onDragStart={() => setDrag(a.id)} className="raised rounded-xl p-3 cursor-grab active:cursor-grabbing">
                  <Link href={c.id === "interview" ? `/app/interviews/${a.id}` : `/app/jobs/${a.job_id}`} className="text-sm font-medium hover:underline">{a.ps_jobs.title}</Link>
                  <p className="text-xs text-muted">{a.ps_jobs.company_name}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.primary_gift ? <span className="chip">{pro[a.primary_gift]}</span> : null}
                    {c.id === "followup" ? <span className="chip chip-pom">Follow up</span> : null}
                    <span className="chip num">{ago(a.stage_changed_at)} in stage</span>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5 num">{a.applied_at ? `Sent ${a.applied_at.slice(0, 10)}` : `Created ${a.created_at.slice(0, 10)}`}{a.next_action ? ` · ${a.next_action}` : ""}</p>
                  <select className="field mt-2 py-1 text-xs md:hidden" value="" onChange={(e) => { setDrag(a.id); setTimeout(() => drop(e.target.value)); }}>
                    <option value="">Move to...</option>
                    {COLS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
