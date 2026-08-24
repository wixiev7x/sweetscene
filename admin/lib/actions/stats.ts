"use server";

import { createClient } from "@/lib/supabase/server";
import type { AdminStats } from "@/lib/types";

export async function getStats(): Promise<AdminStats | null> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_admin_stats");

  return data as unknown as AdminStats;
}
