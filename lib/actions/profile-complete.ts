"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { redirect } from "next/navigation";

export async function saveProfile(
  username: string,
  pfpUrl: string | null,
  password: string | null,
  bio: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = username.trim();
  if (trimmed.length < 2) {
    return { error: "Username must be at least 2 characters" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      anonymous_username: trimmed,
      ...(pfpUrl ? { anonymous_pfp_url: pfpUrl } : {}),
      ...(bio ? { bio } : {}),
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to update profile" };

  if (password && password.length >= 6) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(user.id, { password });
    } catch {
    }
  }

  redirect("/lobby");
}

export async function resetPassword(newPassword: string): Promise<{ error?: string }> {
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (error) return { error: "Failed to set new password" };
  } catch {
    return { error: "Failed to set new password" };
  }

  redirect("/lobby");
}

export async function confirmAge(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { error: "Failed to confirm age" };
  } catch {
    return { error: "Failed to confirm age" };
  }

  redirect("/lobby");
}
