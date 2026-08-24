"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUser } from "@/lib/types";

export async function listAdmins(): Promise<AdminUser[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, username, role, is_banned, created_at")
    .in("role", ["moderator", "super_admin"])
    .order("role", { ascending: true });

  return (data as unknown as AdminUser[]) ?? [];
}

export async function inviteModerator(
  email: string,
  password: string
): Promise<{ error?: string; userId?: string }> {
  const adminClient = createAdminClient();

  const {
    data: { user },
    error,
  } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return { error: error.message };
  if (!user) return { error: "Failed to create user" };

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: "moderator" })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  return { userId: user.id };
}

export async function demoteModerator(
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "super_admin") {
    return { error: "Not authorized: super_admin required" };
  }

  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (target?.role === "super_admin") {
    return { error: "Cannot demote a super_admin" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role: "user" })
    .eq("id", userId);

  if (error) return { error: error.message };

  const supabaseUser = await createClient();
  await supabaseUser.rpc("log_action", {
    p_action: "demoted_moderator",
    p_entity_type: "user",
    p_entity_id: userId,
  });

  return {};
}
