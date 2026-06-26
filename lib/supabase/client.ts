import { createBrowserClient } from "@supabase/ssr";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Call this inside Client Components to get an authenticated Supabase client.
 */
export function createClient() {
  if (cachedClient) return cachedClient;

  cachedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return cachedClient;
}
