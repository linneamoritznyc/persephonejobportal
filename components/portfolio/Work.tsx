"use client";
import { useState } from "react";
import type { Card } from "@/lib/portfolio";

const KINDS = ["All", "AI", "Labor", "Martech", "Content"] as const;
const NAMES: Record<string, string> = { All: "All work", AI: "AI systems", Labor: "Labor market", Martech: "Martech", Content: "Content and video" };

/** Filterable project grid. Card art is pre-rendered SVG markup from the server. */
export default function Work({ cards, art }: { cards: Card[]; art: Record<string, string> }) {
  const [cur, setCur] = useState<string>("All");
  return (
    <>
      <div className="filters" role="group" aria-label="Filter projects">
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={k === cur} onClick={() => setCur(k)}>
            {NAMES[k]}
          </button>
        ))}
      </div>
      <div className="grid">
        {cards
          .filter((p) => cur === "All" || p.f === cur)
          .map((p) => (
            <article className="card" key={p.key}>
              <div className="art">
                <svg viewBox="0 0 360 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art[p.key] }} />
              </div>
              <div className="body">
                <span className="kind">{p.kind}</span>
                <h3>{p.t}</h3>
                <dl className="moves">
                  <div><dt>Saw</dt><dd>{p.saw}</dd></div>
                  <div><dt>Built</dt><dd>{p.built}</dd></div>
                  <div><dt>Reached</dt><dd>{p.reached}</dd></div>
                </dl>
                {p.url ? <a className="go" href={p.url}>Open the project</a> : null}
                <div className="tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            </article>
          ))}
      </div>
    </>
  );
}
