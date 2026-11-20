"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { loadCtx } from "@/lib/agent/context";
import { understandJob } from "@/lib/agent/understand";
import { scoreAndStore } from "@/lib/agent/score";
import { writeApplication, saveWritten, checkOutgoing, GuardRejection } from "@/lib/agent/write";
import { pushApplicationDraft } from "@/lib/agent/draft";
import { scrapeJobUrl } from "@/lib/hunt/addByUrl";
import { ask, chat, HAIKU, SONNET } from "@/lib/claude";
import { findBannedTerm, lintStyle } from "@/lib/guard";

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string; sentence?: string };

async function rate(key: string, max = 30) {
  const sb = db();
  const { data } = await sb.from("ps_rate").select("*").eq("key", key).maybeSingle();
  const now = Date.now();
  if (!data || now - new Date(data.window_start).getTime() > 60_000) {
    await sb.from("ps_rate").upsert({ key, window_start: new Date().toISOString(), n: 1 });
    return;
  }
  if (data.n >= max) throw new Error("Slow down: too many requests this minute");
  await sb.from("ps_rate").update({ n: data.n + 1 }).eq("key", key);
}

function badSentence(text: string): string | undefined {
  return text.split(/(?<=[.!?])\s+/).find((s) => findBannedTerm(s) || lintStyle(s).length);
}

export async function draftJob(jobId: string, instruction?: string): Promise<R<{ applicationId: string }>> {
  const who = await requireOwner();
  await rate(`draft:${who}`, 10);
  const sb = db();
  try {
    const ctx = await loadCtx(sb);
    const { data: job } = await sb.from("ps_jobs").select("*").eq("id", jobId).single();
    let { data: m } = await sb.from("ps_matches").select("*").eq("job_id", jobId).eq("method", "crosstrees_v1").maybeSingle();
    if (!m) {
      const u = await understandJob(ctx, job);
      await scoreAndStore(ctx, job, u);
      m = (await sb.from("ps_matches").select("*").eq("job_id", jobId).eq("method", "crosstrees_v1").maybeSingle()).data;
    }
    const w = await writeApplication(ctx, job, m ?? {}, undefined, instruction);
    const applicationId = await saveWritten(ctx, jobId, w);
    await pushApplicationDraft(sb, applicationId).catch(() => null);
    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${jobId}`);
    return { ok: true, applicationId };
  } catch (e: any) {
    if (e instanceof GuardRejection) return { ok: false, error: `Blocked by the guard (${e.detail}). Try again or edit by hand.` };
    return { ok: false, error: e.message };
  }
}

export async function draftMany(jobIds: string[]): Promise<R<{ done: number; failed: number }>> {
  await requireOwner();
  let done = 0, failed = 0;
  for (const id of jobIds.slice(0, 8)) {
    const r = await draftJob(id);
    r.ok ? done++ : failed++;
  }
  return { ok: true, done, failed };
}

export async function skipJob(jobId: string, kind: "skipped" | "applied" = "skipped"): Promise<R> {
  await requireOwner();
  await db().from("ps_feedback").insert({ kind, job_id: jobId });
  revalidatePath("/app/jobs");
  return { ok: true };
}

export async function saveForLater(jobId: string, on = true): Promise<R> {
  await requireOwner();
  await db().from("ps_jobs").update({ saved_for_later: on }).eq("id", jobId);
  await db().from("ps_applications").upsert({ job_id: jobId, status: "shortlisted" }, { onConflict: "job_id", ignoreDuplicates: true });
  revalidatePath("/app/jobs");
  return { ok: true };
}

export async function addJobByUrl(url: string): Promise<R<{ jobId: string }>> {
  const who = await requireOwner();
  await rate(`add:${who}`, 10);
  try {
    const sb = db();
    const j = await scrapeJobUrl(url);
    const { data: comp } = await sb.from("ps_companies").select("id,blocked").ilike("name", j.company_name || "-").maybeSingle();
    if (comp?.blocked) return { ok: false, error: "That company is on the blocked list." };
    const { data, error } = await sb
      .from("ps_jobs")
      .upsert({ source: "manual", external_id: url.slice(0, 400), title: j.title, company_name: j.company_name, company_id: comp?.id ?? null, url, location: j.location, description: j.description, deadline: j.deadline, employment_type: j.employment_type, language: j.language, is_open: true, status: "open", track: "stockholm", last_seen_at: new Date().toISOString() }, { onConflict: "source,external_id" })
      .select("id")
      .single();
    if (error) throw error;
    const ctx = await loadCtx(sb);
    const u = await understandJob(ctx, { title: j.title, company_name: j.company_name, description: j.description });
    await scoreAndStore(ctx, { ...j, id: data.id }, u);
    await sb.from("ps_jobs").update({ understood_at: new Date().toISOString() }).eq("id", data.id);
    revalidatePath("/app/jobs");
    return { ok: true, jobId: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function saveDraftText(draftId: string, body: string): Promise<R> {
  await requireOwner();
  const bad = badSentence(body);
  if (bad) return { ok: false, error: "Fix this sentence before saving.", sentence: bad };
  const sb = db();
  const { data: before } = await sb.from("ps_drafts").select("body,kind").eq("id", draftId).single();
  await sb.from("ps_drafts").update({ body, edited_by_me: true, updated_at: new Date().toISOString() }).eq("id", draftId);
  if (before && before.body !== body) {
    await sb.from("ps_feedback").insert({ kind: "draft_edit", draft_id: draftId, before: before.body, after: body });
    // Feedback loop: learn one rule from the edit.
    try {
      const rule = await ask({ model: HAIKU, maxTokens: 120, temperature: 0, system: "Compare the AI draft and the author's edit. Write ONE short writing rule (max 20 words) that captures what the author changed, in imperative form. If the change is trivial, reply NONE.", prompt: `AI DRAFT:\n${before.body}\n\nAUTHOR'S EDIT:\n${body}` });
      if (rule && !/^none/i.test(rule) && !findBannedTerm(rule)) await sb.from("ps_writing_rules").insert({ kind: "style", name: "feedback", rule: rule.replace(/—/g, ","), sort: 500 });
    } catch {}
  }
  return { ok: true };
}

export async function rewriteDraft(draftId: string, mode: "shorter" | "confident" | "swedish" | "english"): Promise<R<{ body: string }>> {
  await requireOwner();
  const sb = db();
  const { data: d } = await sb.from("ps_drafts").select("*").eq("id", draftId).single();
  const how = { shorter: "Make it about 30% shorter. Keep every fact and number.", confident: "Make it more confident and direct. Keep every fact and number.", swedish: "Translate it to natural professional Swedish. Keep every fact and number.", english: "Translate it to natural professional English. Keep every fact and number." }[mode];
  try {
    let out = "";
    for (let i = 0; i < 3; i++) {
      out = await ask({ model: SONNET, maxTokens: 1200, system: `${how} No em dashes. Never use: not just, rather than, isn't, instead of. Return only the text.`, prompt: d!.body });
      try {
        out = checkOutgoing(out, "rewrite");
        break;
      } catch {
        out = "";
      }
    }
    if (!out) return { ok: false, error: "The rewrite failed the style guard three times." };
    await sb.from("ps_drafts").update({ body: out, updated_at: new Date().toISOString() }).eq("id", draftId);
    return { ok: true, body: out };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function setCv(applicationId: string, code: string): Promise<R> {
  await requireOwner();
  if (!/^[1-6][SC]$/.test(code)) return { ok: false, error: "Unknown CV" };
  await db().from("ps_applications").update({ cv_version: code }).eq("id", applicationId);
  await db().from("ps_drafts").update({ cv_code: code }).eq("application_id", applicationId);
  return { ok: true };
}

export async function saveToGmail(applicationId: string): Promise<R<{ mailbox: string }>> {
  await requireOwner();
  const sb = db();
  const { data: drafts } = await sb.from("ps_drafts").select("body").eq("application_id", applicationId);
  for (const d of drafts ?? []) {
    const bad = badSentence(d.body);
    if (bad) return { ok: false, error: "Fix this sentence first.", sentence: bad };
  }
  try {
    const r = await pushApplicationDraft(sb, applicationId);
    if (!r.ok) return { ok: false, error: r.reason };
    return { ok: true, mailbox: r.mailbox };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function markSent(applicationId: string): Promise<R> {
  await requireOwner();
  const sb = db();
  const now = new Date();
  const follow = new Date(now.getTime() + 5 * 86_400_000);
  const { data: app } = await sb.from("ps_applications").update({ status: "sent", applied_at: now.toISOString(), follow_up_at: follow.toISOString(), stage_changed_at: now.toISOString(), next_action: "Follow up on " + follow.toISOString().slice(0, 10) }).eq("id", applicationId).select("job_id,ps_jobs(title,company_name)").single();
  await sb.from("ps_events").insert({ kind: "sent", application_id: applicationId, job_id: app?.job_id, detail: { by: "manual" } });
  const j: any = (app as any)?.ps_jobs;
  const tmpl = "Hi {name}, following up on my application for " + (j?.title ?? "the role") + ". Since applying I built {demo} for your team: {link}. Happy to walk you through it.";
  await sb.from("ps_drafts").upsert({ application_id: applicationId, kind: "follow_up", subject: `Re: ${j?.title ?? ""} - Linnea Moritz`, body: tmpl }, { onConflict: "application_id,kind" });
  revalidatePath("/app/applications");
  return { ok: true };
}

export async function moveApplication(applicationId: string, status: string): Promise<R> {
  await requireOwner();
  const allowed = ["shortlisted", "drafted", "sent", "interview", "offer", "rejected", "withdrawn"];
  if (!allowed.includes(status)) return { ok: false, error: "bad status" };
  const sb = db();
  const patch: any = { status, stage_changed_at: new Date().toISOString() };
  if (status === "sent") {
    patch.applied_at = new Date().toISOString();
    patch.follow_up_at = new Date(Date.now() + 5 * 86_400_000).toISOString();
  }
  if (status === "interview" || status === "offer" || status === "rejected") patch.replied_at = new Date().toISOString();
  const { data } = await sb.from("ps_applications").update(patch).eq("id", applicationId).select("job_id").single();
  await sb.from("ps_events").insert({ kind: `moved:${status}`, application_id: applicationId, job_id: data?.job_id });
  revalidatePath("/app/applications");
  return { ok: true };
}

export async function updateContact(applicationId: string, name: string, linkedin: string): Promise<R> {
  await requireOwner();
  await db().from("ps_applications").update({ contact_name: name, contact_linkedin: linkedin }).eq("id", applicationId);
  return { ok: true };
}

export async function thumbs(jobId: string, value: 1 | -1): Promise<R> {
  await requireOwner();
  const sb = db();
  const { data: m } = await sb.from("ps_matches").select("id").eq("job_id", jobId).eq("method", "crosstrees_v1").maybeSingle();
  await sb.from("ps_feedback").insert({ kind: "thumbs", match_id: m?.id ?? null, job_id: jobId, value });
  if (m) await sb.from("ps_matches").update({ thumbs: value }).eq("id", m.id);
  return { ok: true };
}

/** Mirror edits */
export async function saveExperience(id: string, patch: { saw?: string; built?: string; reached?: string; show_on_portfolio?: boolean; card_title?: string }): Promise<R> {
  await requireOwner();
  const text = Object.values(patch).filter((v) => typeof v === "string").join(" ");
  const bad = findBannedTerm(text);
  if (bad) return { ok: false, error: "Blocked: that text contains a banned term." };
  await db().from("ps_experiences").update(patch).eq("id", id);
  revalidatePath("/");
  revalidatePath("/app/me");
  return { ok: true };
}

export async function saveFact(id: string, text: string): Promise<R> {
  await requireOwner();
  if (findBannedTerm(text)) return { ok: false, error: "Blocked: banned term." };
  const { embed, toPgVector } = await import("@/lib/embed");
  await db().from("ps_facts").update({ text, embedding: toPgVector(embed(text)) }).eq("id", id);
  revalidatePath("/");
  return { ok: true };
}

export async function saveGiftEvidence(id: string, evidence: string[]): Promise<R> {
  await requireOwner();
  if (evidence.some((e) => findBannedTerm(e))) return { ok: false, error: "Blocked: banned term." };
  await db().from("ps_gifts").update({ evidence }).eq("id", id);
  return { ok: true };
}

export async function saveCvSummary(code: string, summary: string): Promise<R> {
  await requireOwner();
  const bad = badSentence(summary);
  if (bad) return { ok: false, error: "Fix this sentence.", sentence: bad };
  await db().from("ps_cv_versions").update({ summary, lead_line: summary }).eq("code", code);
  return { ok: true };
}

export async function practice(applicationId: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<R<{ reply: string }>> {
  const who = await requireOwner();
  await rate(`practice:${who}`, 20);
  const sb = db();
  const { data: app } = await sb.from("ps_applications").select("ps_jobs(title,company_name,description)").eq("id", applicationId).single();
  const j: any = (app as any)?.ps_jobs;
  const reply = await chat({
    system: `You are the hiring manager interviewing Linnea Moritz for ${j?.title} at ${j?.company_name} in Stockholm. Ask one question at a time, realistic for this role, follow up on her answers, and after 6 questions give short, direct feedback. Role description: ${(j?.description ?? "").slice(0, 2500)}`,
    messages: messages.length ? messages : [{ role: "user", content: "I'm ready. Start the interview." }],
  });
  if (messages.length >= 2) await sb.from("ps_stories").insert({ title: `Practice: ${j?.title} at ${j?.company_name}`, notes: [...messages, { role: "assistant", content: reply }].map((m) => `${m.role}: ${m.content}`).join("\n"), tags: ["practice"], fact_ids: [] });
  return { ok: true, reply };
}

export async function setDryRun(on: boolean): Promise<R> {
  await requireOwner();
  await db().from("ps_settings").upsert({ key: "dry_run", value: on, updated_at: new Date().toISOString() });
  return { ok: true };
}

export async function pauseCron(paused: boolean): Promise<R> {
  await requireOwner();
  await db().from("ps_settings").upsert({ key: "cron_paused", value: paused, updated_at: new Date().toISOString() });
  revalidatePath("/app/agent");
  return { ok: true };
}

export async function toggleSource(id: string, enabled: boolean): Promise<R> {
  await requireOwner();
  await db().from("ps_sources").update({ enabled }).eq("id", id);
  revalidatePath("/app/agent");
  return { ok: true };
}

export async function saveFamilyKeywords(id: string, en: string, sv: string): Promise<R> {
  await requireOwner();
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  await db().from("ps_role_families").update({ keywords_en: split(en), keywords_sv: split(sv) }).eq("id", id);
  revalidatePath("/app/agent");
  return { ok: true };
}

/** LanguageTool check for Swedish text (public API). */
export async function checkSwedish(text: string): Promise<R<{ matches: { message: string; context: string; replacement?: string }[] }>> {
  await requireOwner();
  try {
    const base = process.env.LANGUAGETOOL_URL || "https://api.languagetool.org/v2/check";
    const res = await fetch(base, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ text: text.slice(0, 18000), language: "sv" }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, error: `LanguageTool HTTP ${res.status}` };
    const d = await res.json();
    return {
      ok: true,
      matches: (d.matches ?? []).slice(0, 20).map((m: any) => ({ message: m.message, context: text.slice(m.offset, m.offset + m.length), replacement: m.replacements?.[0]?.value })),
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
