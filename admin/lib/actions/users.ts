"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUser, BanRecord } from "@/lib/types";

export async function searchUsers(query: string): Promise<AdminUser[]> {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, role, is_banned, ban_reason, banned_at, created_at")
    .ilike("username", `%${query}%`)
    .limit(50);

  if (!profiles) return [];

  return profiles as unknown as AdminUser[];
}

export async function searchUsersByEmail(
  email: string
): Promise<AdminUser[]> {
  const adminClient = createAdminClient();

  const {
    data: { users },
  } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (!users) return [];

  const matched = users.filter((u) =>
    u.email?.toLowerCase().includes(email.toLowerCase())
  );

  if (matched.length === 0) return [];

  const ids = matched.map((u) => u.id);
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, role, is_banned, ban_reason, banned_at, created_at")
    .in("id", ids);

  if (!profiles) return [];

  const emailMap = new Map(matched.map((u) => [u.id, u.email]));

  return (profiles as unknown as AdminUser[]).map((p) => ({
    ...p,
    email: emailMap.get(p.id),
  }));
}

export async function banUser(
  userId: string,
  reason: string,
  expiresAt: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_ban_user", {
    p_target: userId,
    p_reason: reason,
    p_expires: expiresAt,
  });

  if (error) return { error: error.message };
  return {};
}

export async function unbanUser(
  userId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_unban_user", {
    p_target: userId,
    p_reason: reason,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getBanHistory(userId: string): Promise<BanRecord[]> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("list_ban_history", {
    p_user_id: userId,
  });

  return (data as unknown as BanRecord[]) ?? [];
}
