import { loadPortfolio, applyLens } from "@/lib/portfolio";
import { cubist, PAL } from "@/lib/cubist";
import Work from "@/components/portfolio/Work";

export const revalidate = 3600;

const SKILLS: [string, string][] = [
  ["Build", "TypeScript, React, Next.js, Python, SQL, Supabase, Postgres, Vercel, Railway, Claude Code"],
  ["AI", "Claude API, voice agents, ElevenLabs, Retell AI, agent workflows, AI content pipelines"],
  ["Data and ads", "BigQuery, GA4, Google Tag Manager, Google Ads Scripts, Smart Bidding, Looker"],
  ["Content and trust", "Remotion, video editing, social strategy, Trust & Safety policy, Swedish and English"],
];

export default async function Portfolio({ searchParams }: { searchParams: Promise<{ lens?: string }> }) {
  const { lens } = await searchParams;
  const data = await loadPortfolio();
  const cards = applyLens(data.cards, lens);
  const hero = cubist(7, 1240, 520, 44, true, PAL);
  const art: Record<string, string> = {};
  for (const c of cards) art[c.key] = `<rect width="360" height="170" fill="color-mix(in srgb,var(--plum) 14%,var(--card))"/>` + cubist(c.seed, 360, 170, 14, false, PAL);
  const AP = ["#c2364b", "#2b3fd1", "#d9a43c", "#efe6f2", "#7d2a52", "#e0566a"];
  const ST: [string, number][] = [["Study in red", 3], ["Plane study, ultramarine", 19], ["Tesseract landscape", 29]];

  return (
    <>
      <nav aria-label="Main"><div className="wrap">
        <a className="me" href="#top">Linnea Moritz</a>
        <a className="l" href="#work">Work</a>
        <a className="l" href="#path">Path</a>
        <a className="l" href="#art">Art</a>
        <a className="cta" href="#contact">Hire me</a>
      </div></nav>

      <header className="band hero" id="top"><div className="wrap">
        <div className="top">
          <div>
            <h1 className="name">Linnea Moritz</h1>
            <p className="lead"><b>I find the structure inside messy problems, build the tool that fixes them, and bring people along to use it.</b> Voice agents, labor-market graphs, martech pipelines and video. I am also a cubist painter. Moving to Stockholm for a full-time role.</p>
          </div>
          <div className="stats" aria-label="Highlights">
            {data.stats.map(([n, l]) => <div className="stat" key={l}><strong>{n}</strong><span>{l}</span></div>)}
          </div>
        </div>
        <div className="canvas" aria-label="Generated cubist composition">
          <svg viewBox="0 0 1240 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cubist composition of faceted planes" dangerouslySetInnerHTML={{ __html: hero }} />
          <span className="cap">See it, build it, share it</span>
        </div>
      </div></header>

      <section className="band" id="work"><div className="wrap">
        <div className="sec-head">
          <h2>Selected work</h2>
          <p>Each project follows the same three moves: I saw something others missed, I built the fix end to end, and real people used it.</p>
        </div>
        <Work cards={cards} art={art} />
      </div></section>

      <section className="band" id="skills" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><h2>What I work with</h2><p>I pick the fastest tool for the job, and I fix the code underneath when it breaks.</p></div>
        <div className="skills">{SKILLS.map(([b, p]) => <div key={b}><b>{b}</b><p>{p}</p></div>)}</div>
      </div></section>

      <section className="band" id="people" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="sec-head"><h2>People I&apos;ve brought along</h2><p>The tools matter because people use them. I have spent years getting people to come along with me.</p></div>
        <div className="art-facts" style={{ color: "var(--ink)" }}>
          {data.people.map(([n, l]) => <div key={l}><strong>{n}</strong><span style={{ color: "var(--mute)" }}>{l}</span></div>)}
        </div>
      </div></section>

      <section className="band" id="path" style={{ background: "var(--card)" }}><div className="wrap split">
        <div>
          <h2>The path here</h2>
          <p className="lead" style={{ marginTop: 16 }}>Economics and business at Minerva University, studied in five countries. Then Google, Trust &amp; Safety at three platforms, AI products for US founders, and now digital work for a global nonprofit.</p>
          <div className="art-facts" style={{ marginTop: 28, color: "var(--ink)" }}>
            <div><strong>1.8%</strong><span style={{ color: "var(--mute)" }}>Minerva admission rate</span></div>
            <div><strong>5</strong><span style={{ color: "var(--mute)" }}>countries studied in</span></div>
            <div><strong>2</strong><span style={{ color: "var(--mute)" }}>native languages</span></div>
          </div>
        </div>
        <ul className="time">
          {data.time.map(([w, o, d]) => <li key={w + o}><span className="when">{w}</span><div><b>{o}</b><span>{d}</span></div></li>)}
        </ul>
      </div></section>

      <section className="band art-band" id="art"><div className="wrap">
        <div className="sec-head">
          <h2>The painter</h2>
          <p>I&apos;m a contemporary cubist painter. I break a subject into planes and rebuild it so you see more of it at once. I build software the same way.</p>
        </div>
        <div className="art-grid">
          {ST.map(([cap, seed]) => (
            <figure key={cap}><div className="fr"><svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: cubist(seed, 400, 500, 22, false, AP) }} /></div><figcaption>{cap}, a generated study in my palette</figcaption></figure>
          ))}
        </div>
        <div className="art-facts">
          <div><strong>39</strong><span>exhibitions in 21 cities</span></div>
          <div><strong>3</strong><span>first prizes, including Stockholms Konstsalong 2024</span></div>
          <div><strong>70 x 30 m</strong><span>LED display at Art Basel Hong Kong</span></div>
        </div>
        <p style={{ marginTop: 28 }}><a className="go" href="https://linneamoritz.com/">See the paintings at linneamoritz.com</a></p>
      </div></section>

      <section className="band contact" id="contact"><div className="wrap">
        <h2 style={{ color: "#fff" }}>Let&apos;s build the next one together</h2>
        <p>I&apos;m looking for a full-time, in-office role in Stockholm in AI automation, martech or AI product. Swedish and English are both native.</p>
        <div className="row">
          <a className="btn" href="mailto:linneamoritzcv@gmail.com">linneamoritzcv@gmail.com</a>
          <a className="btn o" href="https://www.linkedin.com/in/linneamoritz">LinkedIn</a>
          <a className="btn o" href="https://github.com/linneamoritznyc">GitHub</a>
        </div>
      </div></section>

      <footer><div className="wrap"><span>Linnea Moritz, Stockholm</span><a className="signin" href="/login">Sign in</a></div></footer>
    </>
  );
}
