import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const SONNET = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const HAIKU = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5";

// USD per million tokens, for ps_agent_runs.cost_usd.
const PRICE: Record<string, { i: number; o: number }> = { sonnet: { i: 3, o: 15 }, haiku: { i: 1, o: 5 } };

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export class CostMeter {
  usd = 0;
  add(model: string, u?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
    if (!u) return;
    const p = model.includes("haiku") ? PRICE.haiku : PRICE.sonnet;
    const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
    this.usd += (inTok * p.i + (u.output_tokens ?? 0) * p.o) / 1_000_000;
  }
}

export interface AskOpts {
  model?: string;
  /** Large stable context (master resume, gift bank). Sent with prompt caching. */
  cached?: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  meter?: CostMeter;
}

export async function ask(o: AskOpts): Promise<string> {
  const model = o.model ?? SONNET;
  const system: Anthropic.TextBlockParam[] = [];
  if (o.cached) system.push({ type: "text", text: o.cached, cache_control: { type: "ephemeral" } });
  if (o.system) system.push({ type: "text", text: o.system });
  const res = await anthropic().messages.create({
    model,
    max_tokens: o.maxTokens ?? 1500,
    temperature: o.temperature ?? 0.4,
    system: system.length ? system : undefined,
    messages: [{ role: "user", content: o.prompt }],
  });
  o.meter?.add(model, res.usage as any);
  return res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
}

export async function askJson<T>(o: AskOpts): Promise<T> {
  const text = await ask({ ...o, temperature: o.temperature ?? 0 });
  const start = text.search(/[\[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error(`No JSON in model reply: ${text.slice(0, 160)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function chat(o: { model?: string; system: string; messages: { role: "user" | "assistant"; content: string }[]; meter?: CostMeter }) {
  const model = o.model ?? SONNET;
  const res = await anthropic().messages.create({ model, max_tokens: 700, temperature: 0.6, system: o.system, messages: o.messages });
  o.meter?.add(model, res.usage as any);
  return res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
}
