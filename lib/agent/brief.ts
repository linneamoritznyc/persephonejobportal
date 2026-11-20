/** Morning brief and weekly LinkedIn post drafts. */
import type { Ctx } from "./context";
import { ask, SONNET, type CostMeter } from "../claude";
import { checkOutgoing } from "./write";
import { daysLeft } from "../score/rank";

export async function morningBrief(ctx: Ctx, today = new Date()) {
  const iso = today.toISOString().slice(0, 10);
  const { data: plan } = await ctx.sb.from("ps_events").select("title,due_date,detail").eq("kind", "plan").order("due_date");
  const todayPlan = plan?.find((p: any) => p.due_date === iso) ?? plan?.find((p: any) => p.due_date > iso);
  const { data: top } = await ctx.sb.from("ps_matches").select("rank_score,score,primary_gift,ps_jobs!inner(title,company_name,deadline,is_open,status,blocked_reason)").eq("method", "crosstrees_v1").eq("ps_jobs.is_open", true).is("ps_jobs.blocked_reason", null).order("rank_score", { ascending: false }).limit(5);
  const { data: soon } = await ctx.sb.from("ps_jobs").select("title,company_name,deadline").eq("is_open", true).gte("deadline", iso).lte("deadline", new Date(today.getTime() + 3 * 86_400_000).toISOString().slice(0, 10));
  const giftOfWeek = ctx.gifts[Math.floor(today.getTime() / (7 * 86_400_000)) % Math.max(ctx.gifts.length, 1)];
  const pro = (id?: string) => ctx.gifts.find((g: any) => g.id === id)?.professional_language?.[0] ?? "";
  const date = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
  const lines = [
    `Good morning, Linnea. ${date}.`,
    "",
    todayPlan ? `Plan: ${todayPlan.title}. Done when: ${todayPlan.detail?.done_when ?? ""}` : "Plan: the 10-day plan is complete. Keep the pipeline moving.",
    "",
    "Deadlines within 3 days:",
    ...(soon?.length ? soon.map((j: any) => `- ${j.company_name}, ${j.title}: ${daysLeft(j.deadline)} days left (${j.deadline})`) : ["- None."]),
    "",
    "Top 5 matches:",
    ...((top ?? []).map((m: any, i: number) => `${i + 1}. ${m.ps_jobs.company_name}, ${m.ps_jobs.title}. Score ${Math.round(m.score)}. Lead with ${pro(m.primary_gift)}.`)),
    "",
    `Strength of the week: ${giftOfWeek?.professional_language?.join(", ") ?? ""}.`,
    "",
    "Drafts are waiting in Gmail. Persephone never sends anything.",
  ];
  return { subject: `Persephone, ${today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Stockholm" })}`, text: checkOutgoing(lines.join("\n"), "morning brief") };
}

export async function linkedinPost(ctx: Ctx, today: Date, meter?: CostMeter) {
  const g = ctx.gifts[Math.floor(today.getTime() / (7 * 86_400_000)) % ctx.gifts.length];
  const text = await ask({
    cached: ctx.master,
    meter,
    maxTokens: 500,
    system: "Write a LinkedIn post for Linnea, 120 to 180 words, English. One strength in professional language, one real piece of work with its numbers from the facts, a line on what image to attach (one of her paintings or a screenshot), and end with: I'm looking for a full-time role on an AI, martech or solutions team in Stockholm. No em dashes. Never use: not just, rather than, isn't, instead of. Never write the internal strength names.",
    prompt: `Strength: ${g.professional_language.join(", ")}. Evidence: ${(g.evidence ?? []).join("; ")}`,
  });
  return { subject: `LinkedIn post: ${g.professional_language[0]}`, text: checkOutgoing(text, "linkedin post") };
}
