"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const GIFT_COLORS: Record<string, string> = { discernment: "#C2364B", giving: "#d9a43c", encouragement: "#4FB38A", apostleship: "#E0A458", vision: "#6f7eff", craftsmanship: "#D9B26A", interpretation: "#2b3fd1", teaching: "#9AA4C0", mercy: "#ff8a9b", stewardship: "#C9D1E3" };

export default function Graph({ nodes, edges, jobs, gifts }: { nodes: any[]; edges: any[]; jobs: any[]; gifts: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [byGift, setByGift] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const pos = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
    const P = pos.current;
    nodes.forEach((n, i) => P.has(n.id) || P.set(n.id, { x: W / 2 + Math.cos(i) * W * 0.3 * Math.random(), y: H / 2 + Math.sin(i) * H * 0.3 * Math.random(), vx: 0, vy: 0 }));
    const maxPr = Math.max(...nodes.map((n) => n.pagerank ?? 0), 1e-6);
    const radius = (n: any) => (n.is_seed ? 9 : 6 + 22 * Math.sqrt((n.pagerank ?? 0) / maxPr)) * devicePixelRatio;
    const color = (n: any) => {
      if (byGift) return GIFT_COLORS[n.gift_id] ?? "#2A3352";
      if (n.is_seed) return "#4f46e5";
      const o = n.overlap ?? 0;
      return o >= 70 ? "#4FB38A" : o >= 40 ? "#D9B26A" : "#E0A458";
    };
    let frame = 0, raf = 0;
    const tick = () => {
      for (const a of nodes) {
        const pa = P.get(a.id)!;
        for (const b of nodes) {
          if (a === b) continue;
          const pb = P.get(b.id)!;
          const dx = pa.x - pb.x, dy = pa.y - pb.y, d2 = dx * dx + dy * dy + 0.01;
          const f = (1800 * devicePixelRatio * devicePixelRatio) / d2;
          pa.vx += (dx / Math.sqrt(d2)) * f;
          pa.vy += (dy / Math.sqrt(d2)) * f;
        }
        pa.vx += (W / 2 - pa.x) * 0.002;
        pa.vy += (H / 2 - pa.y) * 0.002;
      }
      for (const e of edges) {
        const a = P.get(e.source_id), b = P.get(e.target_id);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const k = (d - 140 * devicePixelRatio) * 0.004 * (e.score / 75);
        a.vx += (dx / d) * k; a.vy += (dy / d) * k; b.vx -= (dx / d) * k; b.vy -= (dy / d) * k;
      }
      for (const p of P.values()) { p.vx *= 0.82; p.vy *= 0.82; p.x = Math.max(30, Math.min(W - 30, p.x + p.vx)); p.y = Math.max(30, Math.min(H - 30, p.y + p.vy)); }
      ctx.clearRect(0, 0, W, H);
      for (const e of edges) {
        const a = P.get(e.source_id), b = P.get(e.target_id);
        if (!a || !b) continue;
        ctx.strokeStyle = e.score >= 75 ? "rgba(79,179,138,.55)" : e.score >= 50 ? "rgba(217,178,106,.4)" : "rgba(154,164,192,.25)";
        ctx.lineWidth = (e.score / 40) * devicePixelRatio;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const me = { x: W / 2, y: H / 2 };
      for (const n of nodes) {
        const p = P.get(n.id)!;
        if (n.is_seed) { ctx.strokeStyle = "rgba(194,54,75,.35)"; ctx.lineWidth = devicePixelRatio; ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      }
      ctx.fillStyle = "#db2777"; ctx.beginPath(); ctx.arc(me.x, me.y, 14 * devicePixelRatio, 0, 7); ctx.fill();
      ctx.fillStyle = "#1e1b4b"; ctx.font = `${12 * devicePixelRatio}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.fillText("Linnea", me.x, me.y + 30 * devicePixelRatio);
      for (const n of nodes) {
        const p = P.get(n.id)!;
        ctx.fillStyle = color(n); ctx.beginPath(); ctx.arc(p.x, p.y, radius(n), 0, 7); ctx.fill();
        ctx.fillStyle = "#6b6890"; ctx.font = `${11 * devicePixelRatio}px Inter, sans-serif`; ctx.fillText(n.name, p.x, p.y + radius(n) + 13 * devicePixelRatio);
      }
      if (frame++ < 400) raf = requestAnimationFrame(tick);
    };
    tick();
    const click = (ev: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const x = (ev.clientX - r.left) * devicePixelRatio, y = (ev.clientY - r.top) * devicePixelRatio;
      const hit = nodes.find((n) => { const p = P.get(n.id)!; return Math.hypot(p.x - x, p.y - y) < radius(n) + 6; });
      setSel(hit ?? null);
    };
    c.addEventListener("click", click);
    return () => { cancelAnimationFrame(raf); c.removeEventListener("click", click); };
  }, [nodes, edges, byGift]);

  const live = sel ? jobs.filter((j) => j.found_by_term === `discovery:${sel.id}`) : [];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="card p-2 relative">
        <label className="absolute right-4 top-3 text-xs flex items-center gap-2 z-10"><input type="checkbox" checked={byGift} onChange={(e) => setByGift(e.target.checked)} /> Colour by strength</label>
        <canvas ref={ref} className="w-full h-[520px] cursor-pointer" aria-label="Occupation graph" />
      </div>
      <aside className="card p-4 text-sm space-y-2">
        {sel ? (
          <>
            <h2 className="display text-2xl">{sel.name}</h2>
            <p className="num">Overlap {sel.overlap ?? "-"}% · PageRank {(sel.pagerank ?? 0).toFixed(4)}</p>
            {sel.gift_id ? <p className="text-muted">Draws on: {gifts[sel.gift_id]}</p> : null}
            <p className="text-muted">Gap skills: {(sel.gap_skills ?? []).join(", ") || "none"}</p>
            <p className="text-muted">Search terms: {[sel.name, ...(sel.alt_titles ?? []).slice(0, 2)].join(", ")}</p>
            <p className="text-xs text-muted pt-2">Live jobs found through it</p>
            {live.length ? live.map((j) => <Link key={j.id} href={`/app/jobs/${j.id}`} className="block hover:underline">{j.company_name}, {j.title}</Link>) : <p className="text-muted">None yet. The next daily run searches for it.</p>}
          </>
        ) : (
          <p className="text-muted">Click an occupation to see its overlap, gap skills and the jobs it found.</p>
        )}
      </aside>
    </div>
  );
}
