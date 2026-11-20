import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// USD per million tokens for cost tracking in ps_agent_runs.
const PRICE = { input: 3, output: 15 };

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export class CostMeter {
  usd = 0;
  add(usage?: { input_tokens?: number; output_tokens?: number }) {
    if (!usage) return;
    this.usd += ((usage.input_tokens ?? 0) * PRICE.input + (usage.output_tokens ?? 0) * PRICE.output) / 1_000_000;
  }
}

export async function ask(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  meter?: CostMeter;
  temperature?: number;
}): Promise<string> {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  opts.meter?.add(res.usage);
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
}

/** Asks for JSON and parses the first JSON object/array in the reply. */
export async function askJson<T>(opts: Parameters<typeof ask>[0]): Promise<T> {
  const text = await ask({ ...opts, temperature: opts.temperature ?? 0 });
  const start = text.search(/[\[{]/);
  const endObj = text.lastIndexOf("}");
  const endArr = text.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start < 0 || end < start) throw new Error(`Claude returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}
