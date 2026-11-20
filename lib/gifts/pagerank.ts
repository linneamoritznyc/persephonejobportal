/**
 * Personalized PageRank over the occupation substitutability graph
 * (ported from the Kompetensgrafen idea). Restart vector on the seed
 * occupations, teleport alpha 0.15, 30 iterations.
 */
export function personalizedPageRank(
  nodes: string[],
  edges: { source_id: string; target_id: string; score: number }[],
  seeds: string[],
  alpha = 0.15,
  iterations = 30
): { rank: Map<string, number>; delta: number } {
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const N = nodes.length;
  const out: { to: number; w: number }[][] = nodes.map(() => []);
  for (const e of edges) {
    const a = idx.get(e.source_id), b = idx.get(e.target_id);
    if (a === undefined || b === undefined) continue;
    out[a].push({ to: b, w: e.score });
    out[b].push({ to: a, w: e.score * 0.6 }); // substitutability is roughly two-way
  }
  const restart = new Array(N).fill(0);
  const seedIdx = seeds.map((s) => idx.get(s)).filter((x): x is number => x !== undefined);
  for (const s of seedIdx) restart[s] = 1 / seedIdx.length;
  if (!seedIdx.length) restart.fill(1 / N);
  let r = [...restart];
  let delta = 1;
  for (let it = 0; it < iterations; it++) {
    const next = restart.map((x) => alpha * x);
    for (let i = 0; i < N; i++) {
      const tot = out[i].reduce((s, e) => s + e.w, 0);
      if (!tot) {
        for (let j = 0; j < N; j++) next[j] += (1 - alpha) * r[i] * restart[j];
        continue;
      }
      for (const e of out[i]) next[e.to] += (1 - alpha) * r[i] * (e.w / tot);
    }
    delta = next.reduce((s, x, i) => s + Math.abs(x - r[i]), 0);
    r = next;
  }
  return { rank: new Map(nodes.map((n, i) => [n, r[i]])), delta };
}
