/** Minimal RFC 5322 / MIME builder for drafts (text body + PDF attachments). Builds bytes only. */
import { randomBytes } from "crypto";

const enc = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const b64 = (b: Buffer) => b.toString("base64").replace(/.{76}/g, "$&\r\n");

export function buildMime(o: { from: string; to?: string | null; subject: string; text: string; attachments?: { filename: string; content: Buffer; contentType?: string }[] }): Buffer {
  const boundary = `ps_${randomBytes(12).toString("hex")}`;
  const head = [
    `From: ${o.from}`,
    o.to ? `To: ${o.to}` : null,
    `Subject: ${enc(o.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(10).toString("hex")}@persephone.local>`,
    "MIME-Version: 1.0",
  ].filter(Boolean) as string[];
  const body = b64(Buffer.from(o.text.replace(/\r?\n/g, "\r\n"), "utf8"));
  if (!o.attachments?.length) {
    return Buffer.from([...head, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", body, ""].join("\r\n"));
  }
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
    ...o.attachments.flatMap((a) => [
      `--${boundary}`,
      `Content-Type: ${a.contentType ?? "application/pdf"}; name="${enc(a.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${enc(a.filename)}"`,
      "",
      b64(a.content),
    ]),
    `--${boundary}--`,
    "",
  ];
  return Buffer.from([...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", ...parts].join("\r\n"));
}
