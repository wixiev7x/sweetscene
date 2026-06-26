import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth callback. Exchanges the `code` for a session, then
 * redirects to /lobby (or the `next` query param). The server client's
 * cookie adapter persists the session cookies on the response.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/lobby";

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