/** Maps a job's skill label onto one of my skills (exact, alias, containment or token overlap). */
import { normalizeSkill } from "../match";

export interface MySkill { name: string; aliases: string[] }

export class SkillIndex {
  private keys = new Map<string, string>(); // normalized key -> canonical my-skill name
  constructor(skills: MySkill[]) {
    for (const s of skills) {
      this.keys.set(normalizeSkill(s.name), s.name);
      for (const a of s.aliases ?? []) this.keys.set(normalizeSkill(a), s.name);
    }
  }
  match(label: string): string | null {
    const n = normalizeSkill(label);
    if (!n) return null;
    const exact = this.keys.get(n);
    if (exact) return exact;
    const toks = new Set(n.split(" ").filter((t) => t.length > 1));
    let best: [number, string] | null = null;
    for (const [k, name] of this.keys) {
      if (k.length > 3 && n.length > 3 && (n.includes(k) || k.includes(n))) return name;
      const kt = k.split(" ").filter((t) => t.length > 1);
      const inter = kt.filter((t) => toks.has(t)).length;
      const j = inter / (new Set([...kt, ...toks]).size || 1);
      if (j >= 0.5 && (!best || j > best[0])) best = [j, name];
    }
    return best ? best[1] : null;
  }
  /** The set of normalized names I have, for the fit functions. */
  mineSet(): Set<string> {
    return new Set([...this.keys.values()].map(normalizeSkill));
  }
}
