/**
 * Understand a job: Claude Haiku extracts required / preferred / bonus skills,
 * years required, employment type and the Gift Read, in one call.
 */
import { askJson, HAIKU, type CostMeter } from "../claude";
import type { Ctx } from "./context";

export interface Understanding {
  skills: { name: string; importance: "required" | "preferred" | "bonus"; years: number | null }[];
  years_required: number | null;
  permanent_full_time: boolean | null;
  family: string | null;
  gift_read: {
    gifts_called_for: { gift: string; evidence_in_ad: string; weight: number }[];
    primary_gift: string;
    secondary_gift: string;
    gift_fit: number;
  };
}

export async function understandJob(ctx: Ctx, job: { title: string; company_name: string; description: string | null }, meter?: CostMeter): Promise<Understanding> {
  const gifts = ctx.gifts.map((g: any) => `${g.id} (${(g.professional_language ?? []).join(", ")})`).join("; ");
  const families = ctx.families.map((f: any) => `${f.id}: ${f.name}`).join("; ");
  const mine = ctx.skills.map((s) => s.name).join(", ");
  const desc = (job.description ?? "").slice(0, 7000) || "(no description; infer the typical requirements for this exact title at this company)";
  return askJson<Understanding>({
    model: HAIKU,
    maxTokens: 1400,
    meter,
    system: [
      "You read a job posting and return JSON only.",
      "skills: 6 to 16 items. Use the candidate's skill names where the posting asks for the same thing. Candidate skills: " + mine,
      "importance: required | preferred | bonus. years: number or null.",
      "permanent_full_time: true if permanent full-time, false if contract, freelance, interim, part-time, staffing agency or fixed-term, null if unclear.",
      "family: the best role family id. Families: " + families,
      "gift_read: which strengths the ad calls for, from this list only: " + gifts + ". gift_fit 0 to 1 is how strongly the ad calls for the candidate's top strengths. evidence_in_ad quotes the ad's own words.",
      'Shape: {"skills":[{"name":"","importance":"required","years":null}],"years_required":null,"permanent_full_time":true,"family":"1","gift_read":{"gifts_called_for":[{"gift":"interpretation","evidence_in_ad":"","weight":0.9}],"primary_gift":"interpretation","secondary_gift":"craftsmanship","gift_fit":0.7}}',
    ].join("\n"),
    prompt: `Title: ${job.title}\nCompany: ${job.company_name}\n\n${desc}`,
  });
}
