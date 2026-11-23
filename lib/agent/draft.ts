/** Pushes an application's email into Gmail Drafts with the CV and cover letter PDFs attached. */
import { saveDraft, draftsConfigured } from "../mail/imapDraft";
import { renderLetter } from "../pdf";
import { assertNoBannedTerms } from "../guard";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function cvPdf(sb: SupabaseClient, code: string): Promise<Buffer | null> {
  const { data } = await sb.storage.from("cv").download(`branches/${code}.pdf`);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

export async function pushApplicationDraft(sb: SupabaseClient, applicationId: string, opts: { dryRun?: boolean } = {}) {
  if (!draftsConfigured()) return { ok: false as const, reason: "Add GMAIL_DRAFTS_APP_PASSWORD in Vercel to turn on drafts" };
  const { data: app } = await sb.from("ps_applications").select("id,job_id,cv_version,ps_jobs(title,company_name,raw)").eq("id", applicationId).single();
  const { data: drafts } = await sb.from("ps_drafts").select("*").eq("application_id", applicationId);
  const email = drafts?.find((d: any) => d.kind === "email");
  const letter = drafts?.find((d: any) => d.kind === "cover_letter");
  if (!app || !email || !letter) return { ok: false as const, reason: "Write the drafts first" };
  const job: any = (app as any).ps_jobs;
  for (const t of [email.body, letter.body, email.subject ?? ""]) assertNoBannedTerms(t);
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Stockholm" });
  const letterPdf = await renderLetter({
    name: "Linnea Moritz",
    contact: "Stockholm  |  linneacv@gmail.com  |  linkedin.com/in/linneamoritz  |  github.com/linneamoritznyc",
    date,
    company: job.company_name,
    role: job.title,
    body: letter.body,
  });
  const cv = await cvPdf(sb, app.cv_version ?? "1S");
  const attachments: { filename: string; content: Buffer }[] = [{ filename: `Linnea Moritz - Cover letter - ${job.company_name}.pdf`, content: Buffer.from(letterPdf) }];
  if (cv) attachments.push({ filename: `Linnea Moritz - CV.pdf`, content: cv });
  const res = await saveDraft({ to: job.raw?.apply_email ?? null, subject: email.subject ?? `${job.title} - Linnea Moritz`, text: email.body, attachments, dryRun: opts.dryRun });
  await sb.from("ps_drafts").update({ gmail_draft_uid: `${res.mailbox}:${res.uid}`, gmail_drafted_at: new Date().toISOString(), label: res.mailbox }).eq("id", email.id);
  await sb.from("ps_events").insert({ kind: opts.dryRun ? "gmail_test_draft" : "gmail_draft", job_id: app.job_id, application_id: app.id, detail: res });
  return { ok: true as const, ...res };
}

/** A plain-text draft with no attachments (morning brief, LinkedIn post, prep docs). */
export async function pushNote(subject: string, text: string, dryRun?: boolean) {
  assertNoBannedTerms(`${subject}\n${text}`);
  if (!draftsConfigured()) return { ok: false as const, reason: "no app password" };
  const res = await saveDraft({ subject, text, dryRun });
  return { ok: true as const, ...res };
}
