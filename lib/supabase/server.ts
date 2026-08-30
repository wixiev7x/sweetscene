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
             and secure:true. */
          cookieStore.set(name, value, {
            ...options,
            httpOnly: false,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        },
        remove(name: string, options: Record<string, unknown>) {
          /* Mirror the same attributes as set() so the browser actually
             deletes the cookie — mismatched path/scope leaves it alive. */
          cookieStore.set(name, "", {
            ...options,
            httpOnly: false,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 0,
          });
        },
      },
    }
  );
}
