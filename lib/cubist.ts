/** Seeded cubist polygon generator, ported from portfolio/index.html. Pure, works on server and client. */
export const PAL = [
  "var(--red)", "var(--blue)", "var(--ochre)", "var(--ink)",
  "color-mix(in srgb,var(--red) 55%,var(--bg))",
  "color-mix(in srgb,var(--blue) 45%,var(--bg))",
  "color-mix(in srgb,var(--ochre) 60%,var(--bg))",
];

export const rnd = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647;

export function cubist(seed: number, W: number, H: number, n: number, anim: boolean, cols: string[] = PAL): string {
  const r = rnd(seed);
  let o = "";
  for (let i = 0; i < n; i++) {
    const cx = r() * W, cy = r() * H, s = (0.18 + r() * 0.42) * Math.min(W, H), k = 3 + Math.floor(r() * 3), a0 = r() * 6.28;
    const pts: string[] = [];
    for (let j = 0; j < k; j++) {
      const a = a0 + (j * 6.28) / k + (r() - 0.5) * 0.6, rr = s * (0.55 + r() * 0.6);
      pts.push((cx + Math.cos(a) * rr).toFixed(1) + "," + (cy + Math.sin(a) * rr).toFixed(1));
    }
    const c = cols[Math.floor(r() * cols.length)], op = (0.55 + r() * 0.45).toFixed(2);
    const dx = ((r() - 0.5) * 24).toFixed(1) + "px", dy = ((r() - 0.5) * 24).toFixed(1) + "px";
    o += `<polygon class="${anim ? "facet" : ""}" style="--dx:${dx};--dy:${dy};mix-blend-mode:multiply" points="${pts.join(" ")}" fill="${c}" fill-opacity="${op}"/>`;
    if (r() > 0.55) o += `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--bg)" stroke-opacity=".5" stroke-width="1.5"/>`;
  }
  for (let i = 0; i < Math.floor(n / 3); i++) {
    const x = r() * W, y = r() * H, l = (0.2 + r() * 0.5) * W, a = r() * 3.14;
    o += `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(a) * l).toFixed(1)}" y2="${(y + Math.sin(a) * l).toFixed(1)}" stroke="var(--bg)" stroke-opacity=".35" stroke-width="1"/>`;
  }
  return o;
}

/** Same generator with literal colours, for places without CSS variables (OG image, PDFs). */
export function cubistLiteral(seed: number, W: number, H: number, n: number, bg = "#3a2142") {
  const lit = ["#c2364b", "#2b3fd1", "#d9a43c", "#15131a", "#e09aa5", "#9aa4ea", "#ecd29d"];
  return cubist(seed, W, H, n, false, lit).replace(/var\(--bg\)/g, bg).replace(/mix-blend-mode:multiply/g, "");
}
