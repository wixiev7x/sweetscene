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
          cookieStore.set(name, value, {
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
            ...options,
          });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set(name, "", {
            maxAge: 0,
            ...options,
          });
        },
      },
    }
  );
}
