"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth";

export async function sendMagicLink(fd: FormData): Promise<{ ok: boolean; msg: string }> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  // Same answer for every address, so the allowlist can't be probed.
  const generic = { ok: true, msg: "If that address is allowed, a sign-in link is on its way." };
  if (!isOwnerEmail(email)) return generic;
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback?next=/app` },
  });
  if (error) return { ok: false, msg: `Could not send the link: ${error.message}` };
  return generic;
}
