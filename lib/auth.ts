import "server-only";
import { createClient } from "./supabase/server";

export const OWNER_EMAILS = [
  "linnea.moritz@uni.minerva.edu",
  "linneajobs@gmail.com",
];

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase().trim());
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

/**
 * API guard: allows the logged-in owner, or a request carrying
 * `Authorization: Bearer PERSEPHONE_ADMIN_TOKEN` (for Claude / MCP-style callers).
 */
export async function authorize(req: Request): Promise<{ ok: boolean; who: string }> {
  const token = process.env.PERSEPHONE_ADMIN_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  if (token && header === `Bearer ${token}`) return { ok: true, who: "admin-token" };
  const owner = await currentOwner();
  return owner ? { ok: true, who: owner } : { ok: false, who: "" };
}
