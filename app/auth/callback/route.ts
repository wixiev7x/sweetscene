import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth callback. Exchanges the `code` for a session, then
 * redirects to /lobby (or the validated `next` query param). The
 * server client's cookie adapter persists the session cookies on the
 * response.
 *
 * S8/H3: the `next` param is validated to prevent open redirects.
 * Only same-origin paths starting with exactly one `/` followed by a
 * non-slash character are allowed. Anything else falls back to /lobby.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/lobby";

  /* S8/H3: validate next to a same-origin path only.
     Allowed: "/lobby", "/chat/abc", "/profile"
     Rejected: "//evil.com", "https://evil.com", "/\\evil.com" */
  let next = "/lobby";
  if (nextRaw && /^\/[^/].*$/.test(nextRaw) && !nextRaw.startsWith("//")) {
    next = nextRaw;
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}