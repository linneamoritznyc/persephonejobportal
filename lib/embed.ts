/**
 * Local 384-dim embeddings for pgvector, with no external service.
 * Feature hashing over normalised unigrams + bigrams with sublinear TF,
 * signed buckets and L2 normalisation, so cosine similarity in Postgres
 * behaves like a lexical-semantic match. Skill aliases are folded first
 * so "Next.js" and "nextjs" land in the same bucket.
 */
export const EMBED_DIM = 384;

const STOP = new Set(
  "a an the and or of to in on for with at by from as is are was were be been this that these those it its we you your our i my me they their will can not no into over per about than then also has have had which who what when where how all any each more most other some such only own same so too very just och att det som en ett är på för med av till den har de inte om ska vi du kan eller".split(" ")
);

const ALIASES: Record<string, string> = {
  "next.js": "nextjs", "node.js": "nodejs", "react.js": "react", "postgresql": "postgres",
  "ga4": "googleanalytics", "google analytics": "googleanalytics", "gtm": "googletagmanager",
  "llm": "ai", "llms": "ai", "genai": "ai", "artificial intelligence": "ai", "machine learning": "ml",
  "typescript": "typescript", "js": "javascript", "claude": "anthropic", "anthropic": "anthropic",
  "trust & safety": "trustsafety", "trust and safety": "trustsafety", "content moderation": "trustsafety",
  "automation": "automate", "automations": "automate", "automating": "automate", "automated": "automate",
};

export function tokenize(text: string): string[] {
  let t = (text || "").toLowerCase().normalize("NFKC");
  for (const [k, v] of Object.entries(ALIASES)) t = t.split(k).join(` ${v} `);
  return t
    .replace(/[^a-z0-9åäöéü+#]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 5 && w.endsWith("s") ? w.slice(0, -1) : w));
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const toks = tokenize(text);
  const feats = new Map<string, number>();
  toks.forEach((w, i) => {
    feats.set(w, (feats.get(w) ?? 0) + 1);
    if (i > 0) feats.set(`${toks[i - 1]}_${w}`, (feats.get(`${toks[i - 1]}_${w}`) ?? 0) + 0.6);
  });
  const v = new Array<number>(EMBED_DIM).fill(0);
  for (const [f, tf] of feats) {
    const h = hash(f);
    const sign = (h & 1) === 0 ? 1 : -1;
    v[h % EMBED_DIM] += sign * (1 + Math.log(tf));
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => Number((x / norm).toFixed(6)));
}

export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
