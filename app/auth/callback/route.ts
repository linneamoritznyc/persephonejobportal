import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth";

/** Handles both PKCE (?code=) and token-hash (?token_hash=&type=) magic links. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/app";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") || "magiclink") as "magiclink" | "email";
  const supabase = await createClient();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (ok) {
    const { data } = await supabase.auth.getUser();
    if (isOwnerEmail(data.user?.email)) return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/app", url.origin));
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login?e=1", url.origin));
}
