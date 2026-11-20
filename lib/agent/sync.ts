/** Reads Gmail Drafts and Sent (read-only) and marks applications Sent when their draft has gone out. */
import type { Ctx } from "./context";
import { draftState, draftsConfigured } from "../mail/imapDraft";

export async function syncSent(ctx: Ctx): Promise<number> {
  if (!draftsConfigured()) return 0;
  const { data: apps } = await ctx.sb.from("ps_applications").select("id,job_id,ps_drafts(kind,subject,gmail_drafted_at)").eq("status", "drafted");
  const pairs = (apps ?? []).map((a: any) => ({ a, subj: a.ps_drafts?.find((d: any) => d.kind === "email" && d.gmail_drafted_at)?.subject })).filter((p) => p.subj);
  if (!pairs.length) return 0;
  const state = await draftState(pairs.map((p) => p.subj));
  let n = 0;
  for (const p of pairs) {
    if (state[p.subj] !== "sent") continue;
    const now = new Date();
    await ctx.sb.from("ps_applications").update({ status: "sent", applied_at: now.toISOString(), follow_up_at: new Date(now.getTime() + 5 * 86_400_000).toISOString(), stage_changed_at: now.toISOString(), next_action: "Follow up in 5 days" }).eq("id", p.a.id);
    await ctx.sb.from("ps_events").insert({ kind: "sent_detected", job_id: p.a.job_id, application_id: p.a.id, detail: { via: "imap" } });
    n++;
  }
  return n;
}
