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
 * non-slash, non-backslash character are allowed. Anything else falls
 * back to /lobby.
 *
 * Phase 9: After session exchange, records ToS acceptance (via the
 * user client) and age cohort (via the admin client — set_age_cohort
 * is service_role-only so users cannot self-assert via direct RPC).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/lobby";

  /* S8/H3: validate next to a same-origin path only.
      Allowed: "/lobby", "/chat/abc", "/profile"
      Rejected: "//evil.com", "https://evil.com", "/\\evil.com" */
  let next = "/lobby";
  if (
    nextRaw &&
    /^\/[^/\\].*$/.test(nextRaw) &&
    !nextRaw.startsWith("//") &&
    !nextRaw.includes("\\")
  ) {
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

/* Phase 9: record ToS acceptance (user client — authenticated RPC)
      and age cohort (admin client — service_role-only RPC). */

  const { error: tosError } = await supabase.rpc("accept_tos");
  if (tosError) {
    /* Non-blocking — user can still proceed; column defaults to NULL. */
  }

  /* SECURITY (Phase 12): the age cohort is NO LONGER derived here.
     This route previously read a `sweetscene_age_cohort` cookie — written
     by browser JS in app/page.tsx — and passed it to the service-role
     set_age_cohort RPC. Because the input was attacker-controlled, the
     whole 18+ NSFW gate fell to one devtools line:

         document.cookie = "sweetscene_age_cohort=adult; path=/"

     The birthdate is now submitted post-auth through the authenticated
     `set_own_age_cohort` RPC (see lib/actions/profile.ts:submitBirthdate),
     which computes the age in SQL. Accounts with no birthdate on file
     have a NULL cohort and fail closed at every NSFW check. */

  return NextResponse.redirect(`${origin}${next}`);
}