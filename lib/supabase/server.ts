import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Call this inside Server Actions or Server Components to get an authenticated Supabase client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          /* Auth cookies must be readable by the browser Supabase client
             (@supabase/ssr reads the session from document.cookie), so
             httpOnly stays false — the standard @supabase/ssr pattern.
             XSS exposure of the JWT is mitigated by CSP, sameSite lax,
             and secure:true. When the user ticked "Remember me" the
             login page set the sweetscene-remember cookie, and the
             session cookie lives 30 days instead of 7.
             try/catch: in Server Components cookies() is READ-ONLY —
             without this, any page-level getUser() that needs to clear
             or refresh a dead session 500s ("Cookies can only be
             modified in a Server Action or Route Handler"). Found via
             the Phase 4 banned-redirect E2E; Server Actions are
             unaffected (set still succeeds there). */
          const remember = cookieStore.get("sweetscene-remember")?.value === "1";
          try {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: false,
              sameSite: "lax",
              secure: true,
              path: "/",
              maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
            });
          } catch {
            /* read-only in this context — keep the request alive */
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          /* Mirror the same attributes as set() so the browser actually
             deletes the cookie — mismatched path/scope leaves it alive.
             Same try/catch rationale as set(). */
          try {
            cookieStore.set(name, "", {
              ...options,
              httpOnly: false,
              sameSite: "lax",
              secure: true,
              path: "/",
              maxAge: 0,
            });
          } catch {
            /* read-only in this context — keep the request alive */
          }
        },
      },
    }
  );
}
