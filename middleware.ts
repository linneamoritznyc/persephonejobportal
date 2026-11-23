import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function allowed(email?: string | null) {
  const list = (process.env.COCKPIT_ALLOWED_EMAILS || "linneamoritzcv@gmail.com").split(",").map((e) => e.trim().toLowerCase());
  return !!email && list.includes(email.toLowerCase());
}

/** Protects /app/* and /api/cockpit/*. Public portfolio routes never touch Supabase. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!allowed(data.user?.email)) {
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/app/:path*", "/api/cockpit/:path*"] };
