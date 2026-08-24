"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error?: string; needsMFA?: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "moderator" && role !== "super_admin") {
    await supabase.auth.signOut();
    return { error: "Not authorized. This login is for administrators only." };
  }

  return { needsMFA: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
