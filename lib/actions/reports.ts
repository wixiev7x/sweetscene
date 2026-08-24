"use server";

import { createClient } from "@/lib/supabase/server";

export async function createReport(
  targetType: string,
  targetId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to report content." };
  }

  if (!targetType || !targetId || !reason.trim()) {
    return { error: "All fields are required." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: reason.trim(),
    status: "open",
  });

  if (error) return { error: error.message };
  return {};
}
