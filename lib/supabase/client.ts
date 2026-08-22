import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vnugflrlzrvngopweixe.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdmbHJsenJ2bmdvcHdlaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNzk0NzQsImV4cCI6MjEwMjk1NTQ3NH0.vn1xL2AQQxqql_06mEhkaILlbjvrcs9XR0bGowengTI";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  cachedClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return cachedClient;
}
