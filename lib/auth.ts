import "server-only";
import { createClient } from "./supabase/server";

/** The only address allowed into the cockpit, unless COCKPIT_ALLOWED_EMAILS overrides it. */
export function allowedEmails(): string[] {
  const env = process.env.COCKPIT_ALLOWED_EMAILS;
  const list = env ? env.split(",") : ["linneamoritzcv@gmail.com"];
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && allowedEmails().includes(email.toLowerCase().trim());
}

/** Returns the logged-in owner's email, or null. */
export async function currentOwner(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return isOwnerEmail(data.user?.email) ? data.user!.email! : null;
  } catch {
    return null;
  }
}

/** Throws unless the caller is the logged-in owner. Used by every server action. */
export async function requireOwner(): Promise<string> {
  const who = await currentOwner();
  if (!who) throw new Error("Not allowed");
  return who;
}

/**
 * API guard: the logged-in owner, or `Authorization: Bearer PERSEPHONE_ADMIN_TOKEN`
 * (for Claude or other MCP-style callers).
 */
export async function authorize(req: Request): Promise<{ ok: boolean; who: string }> {
  const token = process.env.PERSEPHONE_ADMIN_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  if (token && header === `Bearer ${token}`) return { ok: true, who: "admin-token" };
  const owner = await currentOwner();
  return owner ? { ok: true, who: owner } : { ok: false, who: "" };
}
