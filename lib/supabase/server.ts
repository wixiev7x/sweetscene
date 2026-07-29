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
          /* C2: spread caller options first so security defaults
             always win — prevents accidental httpOnly:false override. */
          cookieStore.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        },
        remove(name: string, options: Record<string, unknown>) {
          /* C1: mirror the same security defaults as set() so the
             deletion cookie matches the original's attributes. Without
             path:"/" and secure:true the browser won't delete a
             secure cookie set on path "/". */
          cookieStore.set(name, "", {
            ...options,
            httpOnly: true,
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
