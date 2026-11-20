import "server-only";
import { db } from "./supabase/admin";
import { PORTFOLIO_CARDS, GIFTS } from "./seed/profile";

export interface Card {
  key: string; f: string; kind: string; t: string; saw: string; built: string; reached: string;
  tags: string[]; url?: string | null; seed: number; gifts: string[]; order: number;
}

export interface PortfolioData {
  cards: Card[];
  stats: [string, string][];
  people: [string, string][];
  time: [string, string, string][];
}

function fallback(): PortfolioData {
  return {
    cards: PORTFOLIO_CARDS.map((c) => ({ key: c.key, f: c.filter, kind: c.kind, t: c.title, saw: c.saw, built: c.built, reached: c.reached, tags: c.tags, url: (c as any).url ?? null, seed: c.seed, gifts: c.gifts, order: c.order })),
    stats: [["28,224", "high-intent users found that ads never learned from"], ["11", "production web apps shipped in 2 months"], ["2,000+", "applicants guided in 40+ countries"], ["39", "art exhibitions in 21 cities"]],
    people: [["2,000+", "applicants guided one by one, in 40+ countries"], ["196", "Nordic schools in my outreach CRM"], ["45", "students mentored through capstone projects"], ["120,000 kr", "raised at 15 for women's education in Ethiopia"]],
    time: [],
  };
}

export async function loadPortfolio(): Promise<PortfolioData> {
  const fb = fallback();
  try {
    const sb = db();
    const [{ data: exps }, { data: facts }] = await Promise.all([
      sb.from("ps_experiences").select("categories,card_kind,card_title,saw,built,reached,portfolio_tags,url,art_seed,filter,portfolio_order,gift_ids").eq("show_on_portfolio", true).order("portfolio_order"),
      sb.from("ps_facts").select("id,text,tags").contains("tags", ["portfolio"]).like("id", "P-%").order("id"),
    ]);
    const cards: Card[] = (exps ?? []).map((e: any) => ({
      key: e.categories?.[0] ?? e.card_title, f: e.filter, kind: e.card_kind, t: e.card_title, saw: e.saw, built: e.built,
      reached: e.reached, tags: e.portfolio_tags ?? [], url: e.url, seed: e.art_seed ?? 7, gifts: e.gift_ids ?? [], order: e.portfolio_order ?? 99,
    }));
    const pick = (tag: string) => (facts ?? []).filter((f: any) => f.tags.includes(tag)).map((f: any) => f.text.split("|"));
    return {
      cards: cards.length ? cards : fb.cards,
      stats: (pick("stat") as [string, string][]).length ? (pick("stat") as [string, string][]) : fb.stats,
      people: (pick("people") as [string, string][]).length ? (pick("people") as [string, string][]) : fb.people,
      time: pick("timeline") as [string, string, string][],
    };
  } catch {
    return fb;
  }
}

/** Reorders cards for a strength lens. The lens never appears on the page. */
export function applyLens(cards: Card[], lens?: string | null): Card[] {
  if (!lens || !GIFTS.some((g) => g.id === lens)) return cards;
  return [...cards].sort((a, b) => {
    const ai = a.gifts.indexOf(lens), bi = b.gifts.indexOf(lens);
    return (ai < 0 ? 9 : ai) - (bi < 0 ? 9 : bi) || a.order - b.order;
  });
}
