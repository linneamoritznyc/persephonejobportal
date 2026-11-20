import "server-only";
/**
 * Creates a DRAFT in linneajobs@gmail.com by IMAP APPEND to [Gmail]/Drafts,
 * the same method antiapathyjobportal used (imap.gmail.com + app password).
 *
 * SAFETY: this module never sends mail. It has no SMTP transport and no
 * Gmail send call. The MIME message is built with MailComposer (a pure
 * builder) and only ever appended to the Drafts mailbox with the \Draft flag.
 */
import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer";

export interface DraftAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface DraftInput {
  to?: string;
  subject: string;
  text: string;
  attachments?: DraftAttachment[];
}

export function gmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

async function buildMime(input: DraftInput): Promise<Buffer> {
  const from = process.env.GMAIL_USER!;
  const composer = new MailComposer({
    from: `Linnea Moritz <${from}>`,
    to: input.to || undefined,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? "application/pdf",
    })),
  });
  return composer.compile().build();
}

async function findDraftsMailbox(client: ImapFlow): Promise<string> {
  const boxes = await client.list();
  const special = boxes.find((b) => b.specialUse === "\\Drafts");
  return special?.path ?? "[Gmail]/Drafts";
}

/** Appends one draft. Returns the IMAP UID of the new draft. */
export async function createGmailDraft(input: DraftInput): Promise<{ uid: string; mailbox: string }> {
  if (!gmailConfigured()) throw new Error("GMAIL_APP_PASSWORD is not set");
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });
  await client.connect();
  try {
    const mailbox = await findDraftsMailbox(client);
    const raw = await buildMime(input);
    const res = await client.append(mailbox, raw, ["\\Draft", "\\Seen"]);
    const uid = res && typeof res === "object" && "uid" in res && res.uid ? String(res.uid) : "appended";
    return { uid, mailbox };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Counts drafts whose subject contains the marker (used by verification). */
export async function countDrafts(marker = "Application:"): Promise<number> {
  if (!gmailConfigured()) return 0;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });
  await client.connect();
  try {
    const mailbox = await findDraftsMailbox(client);
    const lock = await client.getMailboxLock(mailbox);
    try {
      const uids = await client.search({ subject: marker });
      return Array.isArray(uids) ? uids.length : 0;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}
