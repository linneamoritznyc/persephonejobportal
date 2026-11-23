import "server-only";
/**
 * The only mail code in Persephone. Ported from the antiapathyjobportal IMAP
 * draft method: connect to imap.gmail.com with an app password and APPEND
 * the message to [Gmail]/Drafts. It exports saveDraft() and a read-only
 * draft-state check. It contains no mail transport of any kind.
 */
import { ImapFlow } from "imapflow";
import { buildMime } from "./mime";

export interface DraftAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface DraftInput {
  to?: string | null;
  subject: string;
  text: string;
  attachments?: DraftAttachment[];
  /** When true, the draft goes to the label Persephone/Test instead of Drafts. */
  dryRun?: boolean;
}

const user = () => process.env.GMAIL_DRAFTS_USER || process.env.GMAIL_USER || "linneamoritzcv@gmail.com";
const pass = () => process.env.GMAIL_DRAFTS_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "";

export function draftsConfigured(): boolean {
  return Boolean(pass());
}

export function draftsAccount(): string {
  return user();
}

function client() {
  return new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: user(), pass: pass().replace(/\s+/g, "") }, logger: false });
}

async function mailboxFor(c: ImapFlow, use: "\\Drafts" | "\\Sent"): Promise<string> {
  const boxes = await c.list();
  return boxes.find((b) => b.specialUse === use)?.path ?? (use === "\\Drafts" ? "[Gmail]/Drafts" : "[Gmail]/Sent Mail");
}

/** Builds the MIME bytes for the draft. */
async function compose(input: DraftInput): Promise<Buffer> {
  return buildMime({ from: `Linnea Moritz <${user()}>`, to: input.to, subject: input.subject, text: input.text, attachments: input.attachments });
}

/** IMAP APPEND to Drafts (or Persephone/Test on dry runs). Returns the mailbox and UID. */
export async function saveDraft(input: DraftInput): Promise<{ mailbox: string; uid: string }> {
  if (!draftsConfigured()) throw new Error("Add GMAIL_DRAFTS_APP_PASSWORD in Vercel to turn on drafts");
  const c = client();
  await c.connect();
  try {
    let mailbox: string;
    if (input.dryRun) {
      mailbox = "Persephone/Test";
      const exists = (await c.list()).some((b) => b.path === mailbox);
      if (!exists) await c.mailboxCreate(mailbox);
    } else mailbox = await mailboxFor(c, "\\Drafts");
    const raw = await compose(input);
    const res = await c.append(mailbox, raw, ["\\Draft", "\\Seen"]);
    const uid = res && typeof res === "object" && "uid" in res && res.uid ? String(res.uid) : "appended";
    return { mailbox, uid };
  } finally {
    await c.logout().catch(() => undefined);
  }
}

/** Read-only: which of these subjects are still drafts, and which appear in Sent. */
export async function draftState(subjects: string[]): Promise<Record<string, "draft" | "sent" | "unknown">> {
  const out: Record<string, "draft" | "sent" | "unknown"> = {};
  if (!draftsConfigured() || subjects.length === 0) return out;
  const c = client();
  await c.connect();
  try {
    for (const [use, state] of [["\\Sent", "sent"], ["\\Drafts", "draft"]] as const) {
      const box = await mailboxFor(c, use);
      const lock = await c.getMailboxLock(box, { readOnly: true });
      try {
        for (const s of subjects) {
          if (out[s] === "sent") continue;
          const uids = await c.search({ subject: s }, { uid: true });
          if (Array.isArray(uids) && uids.length) out[s] = state;
        }
      } finally {
        lock.release();
      }
    }
    for (const s of subjects) out[s] ??= "unknown";
    return out;
  } finally {
    await c.logout().catch(() => undefined);
  }
}

/** Count of unread drafts, for the Today page. */
export async function unreadDraftCount(): Promise<number | null> {
  if (!draftsConfigured()) return null;
  const c = client();
  await c.connect();
  try {
    const box = await mailboxFor(c, "\\Drafts");
    const st = await c.status(box, { messages: true });
    return st.messages ?? 0;
  } finally {
    await c.logout().catch(() => undefined);
  }
}
